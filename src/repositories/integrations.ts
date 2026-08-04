import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

export type ProductCallbackConfig = {
  url: string | null;
  secret: string | null;
};

export type ProductExternalEntryConfig = {
  enabled: boolean;
  issuer: string | null;
  secret: string | null;
  tokenTtlSeconds: number;
  allowedOrigins: string[];
  allowedModes: Array<"portal" | "embed">;
};

export type IntegrationSourceRecord = {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  secretHash: string | null;
  config: Prisma.JsonValue;
};

export type ProductSourceSummary = {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  groupId: string | null;
  config: Prisma.JsonValue;
};

export type ProductGroupSummary = {
  id: string;
  key: string;
  name: string;
};

export type IntegrationEventRecord = {
  id: string;
  caseId: string | null;
  externalId: string;
  idempotencyKey: string;
  status: string;
};

export type IntegrationCallbackAttemptRecord = {
  id: string;
  sourceId: string;
  sourceKey: string;
  sourceName: string;
  caseId: string;
  caseTitle: string;
  eventType: string;
  payload: Prisma.InputJsonValue;
  status: string;
  responseStatus: number | null;
  deliveryAttempts: number;
  lastError: string | null;
  lastAttemptAt: Date | null;
  createdAt: Date;
};

export type IntegrationRepository = {
  findSourceByKey(key: string): Promise<IntegrationSourceRecord | null>;
  findSourcesByKeys(keys: string[]): Promise<IntegrationSourceRecord[]>;
  listProductSources(): Promise<ProductSourceSummary[]>;
  listProductGroups(): Promise<ProductGroupSummary[]>;
  updateSourceCallbackConfig(input: { sourceId: string; callbackUrl?: string; callbackSecret?: string }): Promise<void>;
  findEventByIdempotencyKey(idempotencyKey: string): Promise<IntegrationEventRecord | null>;
  createEvent(input: {
    sourceId: string;
    caseId?: string;
    externalId: string;
    idempotencyKey: string;
    rawPayload: Prisma.InputJsonValue;
    status: string;
  }): Promise<IntegrationEventRecord>;
  createCallbackAttempt(input: {
    sourceId: string;
    caseId: string;
    eventType: string;
    payload: Prisma.InputJsonValue;
  }): Promise<IntegrationCallbackAttemptRecord>;
  markCallbackAttempt(input: {
    attemptId: string;
    status: "SENT" | "FAILED";
    responseStatus?: number | null;
    lastError?: string | null;
  }): Promise<IntegrationCallbackAttemptRecord>;
  listFailedCallbackAttempts(limit?: number): Promise<IntegrationCallbackAttemptRecord[]>;
  markSourceSuccess(sourceId: string): Promise<void>;
  markSourceError(sourceId: string, error: string): Promise<void>;
};

function toSource(record: {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  secretHash: string | null;
  config: Prisma.JsonValue;
}): IntegrationSourceRecord {
  return record;
}

function toEvent(record: {
  id: string;
  caseId: string | null;
  externalId: string;
  idempotencyKey: string;
  status: string;
}): IntegrationEventRecord {
  return record;
}

function toCallbackAttempt(record: {
  id: string;
  sourceId: string;
  caseId: string;
  eventType: string;
  payload: Prisma.JsonValue;
  status: string;
  responseStatus: number | null;
  deliveryAttempts: number;
  lastError: string | null;
  lastAttemptAt: Date | null;
  createdAt: Date;
  source: { key: string; name: string };
  case: { title: string };
}): IntegrationCallbackAttemptRecord {
  return {
    id: record.id,
    sourceId: record.sourceId,
    sourceKey: record.source.key,
    sourceName: record.source.name,
    caseId: record.caseId,
    caseTitle: record.case.title,
    eventType: record.eventType,
    payload: record.payload as Prisma.InputJsonValue,
    status: record.status,
    responseStatus: record.responseStatus,
    deliveryAttempts: record.deliveryAttempts,
    lastError: record.lastError,
    lastAttemptAt: record.lastAttemptAt,
    createdAt: record.createdAt
  };
}

export function getProductCallbackConfig(config: Prisma.JsonValue): ProductCallbackConfig {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { url: null, secret: null };
  }

  const record = config as Record<string, unknown>;
  return {
    url: typeof record.callbackUrl === "string" && record.callbackUrl.trim() ? record.callbackUrl.trim() : null,
    secret: typeof record.callbackSecret === "string" && record.callbackSecret.trim() ? record.callbackSecret.trim() : null
  };
}

export function getProductExternalEntryConfig(config: Prisma.JsonValue): ProductExternalEntryConfig {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return {
      enabled: false,
      issuer: null,
      secret: null,
      tokenTtlSeconds: 300,
      allowedOrigins: [],
      allowedModes: ["embed"]
    };
  }

  const record = config as Record<string, unknown>;
  const externalEntry = record.externalEntry;

  if (!externalEntry || typeof externalEntry !== "object" || Array.isArray(externalEntry)) {
    return {
      enabled: false,
      issuer: null,
      secret: null,
      tokenTtlSeconds: 300,
      allowedOrigins: [],
      allowedModes: ["embed"]
    };
  }

  const entry = externalEntry as Record<string, unknown>;
  const tokenTtlSeconds = Number(entry.tokenTtlSeconds ?? 300);
  const allowedOrigins = Array.isArray(entry.allowedOrigins)
    ? entry.allowedOrigins.filter((origin): origin is string => typeof origin === "string" && origin.trim().length > 0)
    : [];
  const configuredModes = Array.isArray(entry.allowedModes)
    ? entry.allowedModes.filter((mode): mode is "portal" | "embed" => mode === "portal" || mode === "embed")
    : [];

  return {
    enabled: entry.enabled === true,
    issuer: typeof entry.issuer === "string" && entry.issuer.trim() ? entry.issuer.trim() : null,
    secret: typeof entry.secret === "string" && entry.secret.trim() ? entry.secret.trim() : null,
    tokenTtlSeconds: Number.isFinite(tokenTtlSeconds) && tokenTtlSeconds > 0 ? tokenTtlSeconds : 300,
    allowedOrigins,
    allowedModes: configuredModes.length > 0 ? configuredModes : ["embed"]
  };
}

function mergeCallbackConfig(
  config: Prisma.JsonValue,
  input: { callbackUrl?: string; callbackSecret?: string }
): Prisma.InputJsonObject {
  const base =
    config && typeof config === "object" && !Array.isArray(config)
      ? ({ ...(config as Record<string, Prisma.InputJsonValue>) } as Record<string, Prisma.InputJsonValue>)
      : {};
  const callbackUrl = input.callbackUrl?.trim() ?? "";
  const callbackSecret = input.callbackSecret?.trim() ?? "";

  if (input.callbackUrl !== undefined) {
    if (callbackUrl) {
      base.callbackUrl = callbackUrl;
    } else {
      delete base.callbackUrl;
    }
  }

  if (input.callbackSecret !== undefined) {
    if (callbackSecret) {
      base.callbackSecret = callbackSecret;
    } else {
      delete base.callbackSecret;
    }
  }

  return base as Prisma.InputJsonObject;
}

export function createPrismaIntegrationRepository(client: PrismaClient = prisma): IntegrationRepository {
  return {
    async findSourceByKey(key) {
      const record = await client.integrationSource.findUnique({
        where: { key },
        select: {
          id: true,
          key: true,
          name: true,
          enabled: true,
          secretHash: true,
          config: true
        }
      });

      return record ? toSource(record) : null;
    },

    async findSourcesByKeys(keys) {
      if (keys.length === 0) {
        return [];
      }

      const records = await client.integrationSource.findMany({
        where: { key: { in: keys } },
        select: {
          id: true,
          key: true,
          name: true,
          enabled: true,
          secretHash: true,
          config: true
        }
      });

      return records.map(toSource);
    },

    listProductSources() {
      return client.integrationSource.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          key: true,
          name: true,
          enabled: true,
          groupId: true,
          config: true
        }
      });
    },

    listProductGroups() {
      return client.productGroup.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          key: true,
          name: true
        }
      });
    },

    async updateSourceCallbackConfig(input) {
      const source = await client.integrationSource.findUnique({
        where: { id: input.sourceId },
        select: { config: true }
      });

      if (!source) {
        throw new Error("Product source was not found");
      }

      await client.integrationSource.update({
        where: { id: input.sourceId },
        data: {
          config: mergeCallbackConfig(source.config, input)
        }
      });
    },

    async findEventByIdempotencyKey(idempotencyKey) {
      const record = await client.integrationEvent.findUnique({
        where: { idempotencyKey },
        select: {
          id: true,
          caseId: true,
          externalId: true,
          idempotencyKey: true,
          status: true
        }
      });

      return record ? toEvent(record) : null;
    },

    async createEvent(input) {
      const record = await client.integrationEvent.create({
        data: {
          sourceId: input.sourceId,
          caseId: input.caseId,
          externalId: input.externalId,
          idempotencyKey: input.idempotencyKey,
          rawPayload: input.rawPayload,
          status: input.status
        },
        select: {
          id: true,
          caseId: true,
          externalId: true,
          idempotencyKey: true,
          status: true
        }
      });

      return toEvent(record);
    },

    async createCallbackAttempt(input) {
      const record = await client.integrationCallbackAttempt.create({
        data: {
          sourceId: input.sourceId,
          caseId: input.caseId,
          eventType: input.eventType,
          payload: input.payload
        },
        include: {
          source: { select: { key: true, name: true } },
          case: { select: { title: true } }
        }
      });

      return toCallbackAttempt(record);
    },

    async markCallbackAttempt(input) {
      const record = await client.integrationCallbackAttempt.update({
        where: { id: input.attemptId },
        data: {
          status: input.status,
          responseStatus: input.responseStatus,
          lastError: input.lastError,
          deliveryAttempts: { increment: 1 },
          lastAttemptAt: new Date()
        },
        include: {
          source: { select: { key: true, name: true } },
          case: { select: { title: true } }
        }
      });

      return toCallbackAttempt(record);
    },

    async listFailedCallbackAttempts(limit = 50) {
      const records = await client.integrationCallbackAttempt.findMany({
        where: { status: "FAILED" },
        orderBy: { lastAttemptAt: "asc" },
        take: limit,
        include: {
          source: { select: { key: true, name: true } },
          case: { select: { title: true } }
        }
      });

      return records.map(toCallbackAttempt);
    },

    async markSourceSuccess(sourceId) {
      await client.integrationSource.update({
        where: { id: sourceId },
        data: {
          lastSyncAt: new Date(),
          lastError: null
        }
      });
    },

    async markSourceError(sourceId, error) {
      await client.integrationSource.update({
        where: { id: sourceId },
        data: {
          lastError: error
        }
      });
    }
  };
}
