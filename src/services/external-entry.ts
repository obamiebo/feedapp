import { createHmac, timingSafeEqual } from "node:crypto";
import type { AppUser } from "@/domain/types";
import { createPrismaUserRepository, type UserRepository } from "@/repositories/users";

export type ExternalEntryConfig = {
  issuer: string;
  secret: string;
  allowedSourceKeys: string[];
  tokenTtlSeconds: number;
};

export type ExternalEntryClaims = {
  iss: string;
  sub: string;
  email: string;
  name: string;
  sourceKeys: string[];
  iat: number;
  exp: number;
};

export type ExternalEntryFailureReason =
  | "not-configured"
  | "missing-token"
  | "invalid-token"
  | "expired-token"
  | "issuer-mismatch"
  | "source-not-allowed"
  | "user-not-found"
  | "user-not-provisioned"
  | "password-change-required"
  | "user-source-denied";

export type ExternalEntryResult =
  | {
      ok: true;
      user: AppUser;
      sourceKeys: string[];
    }
  | {
      ok: false;
      reason: ExternalEntryFailureReason;
    };

type ExternalEntryDependencies = {
  config: ExternalEntryConfig | null;
  users: UserRepository;
  now: () => Date;
};

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function base64UrlJson(value: string): unknown {
  return JSON.parse(base64UrlDecode(value)) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseClaims(value: unknown): ExternalEntryClaims | null {
  if (!isRecord(value)) return null;
  const sourceKeys = value.sourceKeys;

  if (
    typeof value.iss !== "string" ||
    typeof value.sub !== "string" ||
    typeof value.email !== "string" ||
    typeof value.name !== "string" ||
    typeof value.iat !== "number" ||
    typeof value.exp !== "number" ||
    !Array.isArray(sourceKeys) ||
    !sourceKeys.every((sourceKey): sourceKey is string => typeof sourceKey === "string" && sourceKey.length > 0)
  ) {
    return null;
  }

  return {
    iss: value.iss,
    sub: value.sub,
    email: value.email,
    name: value.name,
    sourceKeys,
    iat: value.iat,
    exp: value.exp
  };
}

function parseConfiguredSources(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((sourceKey) => sourceKey.trim())
    .filter(Boolean);
}

export function externalEntryConfigFromEnv(env: Partial<NodeJS.ProcessEnv> = process.env): ExternalEntryConfig | null {
  const issuer = env.EXTERNAL_ENTRY_ISSUER?.trim();
  const secret = env.EXTERNAL_ENTRY_SECRET?.trim();
  const allowedSourceKeys = parseConfiguredSources(env.EXTERNAL_ENTRY_ALLOWED_SOURCES);
  const tokenTtlSeconds = Number(env.EXTERNAL_ENTRY_TOKEN_TTL_SECONDS ?? 300);

  if (!issuer || !secret || allowedSourceKeys.length === 0) {
    return null;
  }

  return {
    issuer,
    secret,
    allowedSourceKeys,
    tokenTtlSeconds: Number.isFinite(tokenTtlSeconds) && tokenTtlSeconds > 0 ? tokenTtlSeconds : 300
  };
}

function verifySignature(tokenHead: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(tokenHead).digest();
  const actual = Buffer.from(signature, "base64url");

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function verifyExternalEntryToken(
  token: string,
  config: ExternalEntryConfig,
  now: Date = new Date()
): { ok: true; claims: ExternalEntryClaims } | { ok: false; reason: ExternalEntryFailureReason } {
  const parts = token.split(".");

  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    return { ok: false, reason: "invalid-token" };
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  try {
    const header = base64UrlJson(encodedHeader);

    if (!isRecord(header) || header.alg !== "HS256") {
      return { ok: false, reason: "invalid-token" };
    }

    if (!verifySignature(`${encodedHeader}.${encodedPayload}`, signature, config.secret)) {
      return { ok: false, reason: "invalid-token" };
    }

    const claims = parseClaims(base64UrlJson(encodedPayload));

    if (!claims) {
      return { ok: false, reason: "invalid-token" };
    }

    const nowSeconds = Math.floor(now.getTime() / 1000);

    if (claims.iss !== config.issuer) {
      return { ok: false, reason: "issuer-mismatch" };
    }

    if (claims.exp <= nowSeconds) {
      return { ok: false, reason: "expired-token" };
    }

    if (claims.iat > nowSeconds + 60 || nowSeconds - claims.iat > config.tokenTtlSeconds) {
      return { ok: false, reason: "expired-token" };
    }

    const allowed = new Set(config.allowedSourceKeys);
    const requestedAllowedSources = claims.sourceKeys.filter((sourceKey) => allowed.has(sourceKey));

    if (requestedAllowedSources.length === 0) {
      return { ok: false, reason: "source-not-allowed" };
    }

    return { ok: true, claims: { ...claims, sourceKeys: requestedAllowedSources } };
  } catch {
    return { ok: false, reason: "invalid-token" };
  }
}

export type ExternalEntryService = {
  authenticate(token: string | null): Promise<ExternalEntryResult>;
};

export function createExternalEntryService(dependencies?: Partial<ExternalEntryDependencies>): ExternalEntryService {
  const config = dependencies?.config ?? externalEntryConfigFromEnv();
  const users = dependencies?.users ?? createPrismaUserRepository();
  const now = dependencies?.now ?? (() => new Date());

  return {
    async authenticate(token) {
      if (!config) {
        return { ok: false, reason: "not-configured" };
      }

      if (!token) {
        return { ok: false, reason: "missing-token" };
      }

      const verified = verifyExternalEntryToken(token, config, now());

      if (!verified.ok) {
        return verified;
      }

      const user = await users.getAppUserByEmail(verified.claims.email);

      if (!user) {
        return { ok: false, reason: "user-not-found" };
      }

      if (!user.provisioned) {
        return { ok: false, reason: "user-not-provisioned" };
      }

      if (user.passwordMustChange) {
        return { ok: false, reason: "password-change-required" };
      }

      const userSources = new Set(user.productSourceKeys);
      const allowedUserSources = verified.claims.sourceKeys.filter((sourceKey) => userSources.has(sourceKey));

      if (allowedUserSources.length === 0) {
        return { ok: false, reason: "user-source-denied" };
      }

      return {
        ok: true,
        user,
        sourceKeys: allowedUserSources
      };
    }
  };
}
