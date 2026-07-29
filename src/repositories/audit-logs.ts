import type { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

export type CreateAuditLogRecord = {
  actorId?: string;
  caseId?: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
};

export type AuditLogListFilters = {
  action?: string;
  actionPrefixes?: string[];
  actorSearch?: string;
  limit?: number;
};

export type AuditLogListRecord = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  caseId: string | null;
  caseTitle: string | null;
  caseSourceSystem: string | null;
  action: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
};

export type AuditLogRepository = {
  createAuditLog(input: CreateAuditLogRecord): Promise<void>;
  listAuditLogs?(filters?: AuditLogListFilters): Promise<AuditLogListRecord[]>;
};

export function createPrismaAuditLogRepository(client: PrismaClient = prisma): AuditLogRepository {
  return {
    async createAuditLog(input) {
      await client.auditLog.create({
        data: {
          actorId: input.actorId,
          caseId: input.caseId,
          action: input.action,
          metadata: input.metadata
        }
      });
    },

    async listAuditLogs(filters = {}) {
      const actionPrefixFilters = filters.actionPrefixes?.filter(Boolean) ?? [];
      const actorSearch = filters.actorSearch?.trim();
      const records = await client.auditLog.findMany({
        where: {
          action: filters.action || undefined,
          OR:
            filters.action || actionPrefixFilters.length === 0
              ? undefined
              : actionPrefixFilters.map((prefix) => ({
                  action: {
                    startsWith: prefix
                  }
                })),
          actor: actorSearch
            ? {
                OR: [
                  {
                    name: {
                      contains: actorSearch,
                      mode: "insensitive"
                    }
                  },
                  {
                    email: {
                      contains: actorSearch,
                      mode: "insensitive"
                    }
                  }
                ]
              }
            : undefined
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(Math.max(filters.limit ?? 100, 1), 200),
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          case: {
            select: {
              id: true,
              title: true,
              sourceSystem: true
            }
          }
        }
      });

      return records.map((record) => ({
        id: record.id,
        actorId: record.actorId,
        actorName: record.actor?.name ?? null,
        actorEmail: record.actor?.email ?? null,
        caseId: record.caseId,
        caseTitle: record.case?.title ?? null,
        caseSourceSystem: record.case?.sourceSystem ?? null,
        action: record.action,
        metadata: record.metadata,
        createdAt: record.createdAt
      }));
    }
  };
}
