import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { AppUser } from "@/domain/types";
import {
  createExternalEntryService,
  externalEntryConfigFromEnv,
  type ExternalEntryClaims,
  type ExternalEntryConfig,
  verifyExternalEntryToken
} from "@/services/external-entry";

const config: ExternalEntryConfig = {
  issuer: "fihankra-dashboard",
  secret: "entry-secret",
  allowedSourceKeys: ["fihankra-feedback"],
  tokenTtlSeconds: 300
};

const now = new Date("2026-07-31T10:00:00.000Z");
const nowSeconds = Math.floor(now.getTime() / 1000);

function signToken(claims: Partial<ExternalEntryClaims> = {}, secret = config.secret) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: "fihankra-dashboard",
      sub: "user-123",
      email: "ama@fihankra.com",
      name: "Ama Mensah",
      sourceKeys: ["fihankra-feedback"],
      iat: nowSeconds,
      exp: nowSeconds + 300,
      ...claims
    })
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "user-fihankra",
    email: "ama@fihankra.com",
    name: "Ama Mensah",
    roles: ["Product Manager"],
    departmentIds: [],
    directProductSourceKeys: ["fihankra-feedback"],
    productSourceKeys: ["fihankra-feedback"],
    productGroupIds: [],
    assignedCaseIds: [],
    provisioned: true,
    passwordMustChange: false,
    ...overrides
  };
}

describe("external entry service", () => {
  it("loads external entry config from environment variables", () => {
    expect(
      externalEntryConfigFromEnv({
        EXTERNAL_ENTRY_ISSUER: "fihankra-dashboard",
        EXTERNAL_ENTRY_SECRET: "entry-secret",
        EXTERNAL_ENTRY_ALLOWED_SOURCES: "fihankra-feedback, other-source",
        EXTERNAL_ENTRY_TOKEN_TTL_SECONDS: "120"
      })
    ).toEqual({
      issuer: "fihankra-dashboard",
      secret: "entry-secret",
      allowedSourceKeys: ["fihankra-feedback", "other-source"],
      tokenTtlSeconds: 120
    });
  });

  it("verifies signed HS256 tokens and filters to allowed source keys", () => {
    const result = verifyExternalEntryToken(
      signToken({ sourceKeys: ["fihankra-feedback", "untrusted-source"] }),
      config,
      now
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        claims: expect.objectContaining({
          email: "ama@fihankra.com",
          sourceKeys: ["fihankra-feedback"]
        })
      })
    );
  });

  it("rejects tampered or expired tokens", () => {
    expect(verifyExternalEntryToken(signToken({}, "wrong-secret"), config, now)).toEqual({
      ok: false,
      reason: "invalid-token"
    });
    expect(verifyExternalEntryToken(signToken({ exp: nowSeconds - 1 }), config, now)).toEqual({
      ok: false,
      reason: "expired-token"
    });
    expect(verifyExternalEntryToken(signToken({ iat: nowSeconds - config.tokenTtlSeconds - 1 }), config, now)).toEqual({
      ok: false,
      reason: "expired-token"
    });
    expect(verifyExternalEntryToken(signToken({ iat: nowSeconds + 61 }), config, now)).toEqual({
      ok: false,
      reason: "expired-token"
    });
  });

  it("authenticates only provisioned FeedApp users with matching product access", async () => {
    const service = createExternalEntryService({
      config,
      now: () => now,
      users: {
        async getAppUserByEmail() {
          return makeUser();
        }
      } as never
    });

    await expect(service.authenticate(signToken())).resolves.toEqual({
      ok: true,
      user: expect.objectContaining({ id: "user-fihankra" }),
      sourceKeys: ["fihankra-feedback"]
    });
  });

  it("rejects pre-provisioned users without matching FeedApp product grants", async () => {
    const service = createExternalEntryService({
      config,
      now: () => now,
      users: {
        async getAppUserByEmail() {
          return makeUser({ productSourceKeys: [], directProductSourceKeys: [] });
        }
      } as never
    });

    await expect(service.authenticate(signToken())).resolves.toEqual({ ok: false, reason: "user-source-denied" });
  });

  it("rejects users who still need account activation", async () => {
    const service = createExternalEntryService({
      config,
      now: () => now,
      users: {
        async getAppUserByEmail() {
          return makeUser({ passwordMustChange: true });
        }
      } as never
    });

    await expect(service.authenticate(signToken())).resolves.toEqual({ ok: false, reason: "password-change-required" });
  });
});
