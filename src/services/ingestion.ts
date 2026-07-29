import type { Prisma } from "@prisma/client";
import type { IngestionReport } from "@/domain/types";
import type { FeedbackCase } from "@/domain/types";
import { buildIdempotencyKey, hashIntegrationSecret, integrationSecretHeader, integrationSourceHeader, timingSafeEqualText } from "@/lib/integrations";
import type { DepartmentRepository } from "@/repositories/departments";
import { createPrismaDepartmentRepository } from "@/repositories/departments";
import type { IntegrationRepository, IntegrationSourceRecord } from "@/repositories/integrations";
import { createPrismaIntegrationRepository } from "@/repositories/integrations";
import { createCaseService, type CaseService } from "@/services/cases";

export type IngestionAuthResult =
  | {
      ok: true;
      source: IntegrationSourceRecord;
    }
  | {
      ok: false;
      reason: "missing-source" | "unknown-source" | "disabled-source" | "missing-secret" | "invalid-secret";
    };

export type IngestionResult =
  | {
      ok: true;
      duplicate: boolean;
      case: FeedbackCase;
      idempotencyKey: string;
    }
  | {
      ok: false;
      status: 400 | 409;
      error: string;
    };

type IngestionServiceDependencies = {
  cases: CaseService;
  departments: DepartmentRepository;
  integrations: IntegrationRepository;
};

function headerValue(headers: Headers, key: string) {
  return headers.get(key)?.trim() || "";
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function allowedDepartmentKeys(source: IntegrationSourceRecord): string[] {
  if (!isJsonObject(source.config)) return [];
  const keys = source.config.allowedDepartmentKeys;
  return Array.isArray(keys) ? keys.filter((key): key is string => typeof key === "string") : [];
}

function defaultDepartmentKey(source: IntegrationSourceRecord): string | null {
  if (!isJsonObject(source.config)) return null;
  return typeof source.config.defaultDepartmentKey === "string" ? source.config.defaultDepartmentKey : null;
}

export type IngestionService = {
  authenticate(headers: Headers, rawBody: string): Promise<IngestionAuthResult>;
  ingestReport(source: IntegrationSourceRecord, report: IngestionReport, rawPayload: unknown): Promise<IngestionResult>;
};

export function createIngestionService(dependencies?: Partial<IngestionServiceDependencies>): IngestionService {
  const cases = dependencies?.cases ?? createCaseService();
  const departments = dependencies?.departments ?? createPrismaDepartmentRepository();
  const integrations = dependencies?.integrations ?? createPrismaIntegrationRepository();

  return {
    async authenticate(headers, rawBody) {
      void rawBody;
      const sourceKey = headerValue(headers, integrationSourceHeader);
      const secret = headerValue(headers, integrationSecretHeader);

      if (!sourceKey) {
        return { ok: false, reason: "missing-source" };
      }

      const source = await integrations.findSourceByKey(sourceKey);

      if (!source) {
        return { ok: false, reason: "unknown-source" };
      }

      if (!source.enabled) {
        return { ok: false, reason: "disabled-source" };
      }

      if (!source.secretHash) {
        return { ok: false, reason: "missing-secret" };
      }

      if (!secret) {
        return { ok: false, reason: "missing-secret" };
      }

      const secretHash = hashIntegrationSecret(secret);
      return timingSafeEqualText(secretHash, source.secretHash) ? { ok: true, source } : { ok: false, reason: "invalid-secret" };
    },

    async ingestReport(source, report, rawPayload) {
      if (report.sourceSystem !== source.key) {
        return {
          ok: false,
          status: 400,
          error: "sourceSystem must match the authenticated integration source"
        };
      }

      const departmentKey = report.departmentKey || defaultDepartmentKey(source);
      const departmentList = await departments.listDepartments();
      const matchingDepartment = departmentList.find((item) => item.key === departmentKey);

      if (report.departmentKey && !matchingDepartment) {
        await integrations.markSourceError(source.id, `Unknown department key: ${report.departmentKey}`);
        return {
          ok: false,
          status: 400,
          error: "Unknown department key"
        };
      }

      const department = matchingDepartment ?? departmentList[0];

      if (!department) {
        await integrations.markSourceError(source.id, "No routing department is available for product intake");
        return {
          ok: false,
          status: 400,
          error: "No routing department is available"
        };
      }

      const allowedKeys = allowedDepartmentKeys(source);

      if (report.departmentKey && allowedKeys.length > 0 && !allowedKeys.includes(report.departmentKey)) {
        await integrations.markSourceError(source.id, `Department key is not allowed: ${report.departmentKey}`);
        return {
          ok: false,
          status: 400,
          error: "Department key is not allowed for this source"
        };
      }

      const idempotencyKey = buildIdempotencyKey(report.sourceSystem, report.externalId);
      const existingEvent = await integrations.findEventByIdempotencyKey(idempotencyKey);

      if (existingEvent?.caseId) {
        const existingCase = await cases.getCaseDetail(existingEvent.caseId);

        if (existingCase) {
          return {
            ok: true,
            duplicate: true,
            case: existingCase,
            idempotencyKey
          };
        }
      }

      const existingCase = await cases.getCaseBySourceExternalId(report.sourceSystem, report.externalId);

      if (existingCase) {
        await integrations.createEvent({
          sourceId: source.id,
          caseId: existingCase.id,
          externalId: report.externalId,
          idempotencyKey,
          rawPayload: rawPayload as Prisma.InputJsonValue,
          status: "duplicate"
        });
        return {
          ok: true,
          duplicate: true,
          case: existingCase,
          idempotencyKey
        };
      }

      const created = await cases.createManualCase(
        {
          title: report.title,
          description: report.description,
          priority: report.priority,
          departmentId: department.id,
          customer: report.customer,
          sourceSystem: source.key,
          externalId: report.externalId
        },
        undefined
      );

      await integrations.createEvent({
        sourceId: source.id,
        caseId: created.id,
        externalId: report.externalId,
        idempotencyKey,
        rawPayload: rawPayload as Prisma.InputJsonValue,
        status: "accepted"
      });
      await integrations.markSourceSuccess(source.id);

      return {
        ok: true,
        duplicate: false,
        case: created,
        idempotencyKey
      };
    }
  };
}
