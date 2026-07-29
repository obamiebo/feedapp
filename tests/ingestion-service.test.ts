import { describe, expect, it, vi } from "vitest";
import type { FeedbackCase } from "@/domain/types";
import { hashIntegrationSecret } from "@/lib/integrations";
import { createIngestionService } from "@/services/ingestion";

const source = {
  id: "source-commerce",
  key: "commerce-platform",
  name: "Commerce Platform",
  enabled: true,
  secretHash: hashIntegrationSecret("commerce-secret-123"),
  config: {
    allowedDepartmentKeys: ["finance"]
  }
};

const report = {
  sourceSystem: "commerce-platform",
  externalId: "COM-9001",
  title: "Checkout failed",
  description: "Customer cannot complete checkout.",
  priority: "High" as const,
  departmentKey: "finance",
  customer: {
    externalId: "customer-9001",
    name: "Afi Mensah",
    email: "afi@example.com"
  }
};

function makeCase(overrides: Partial<FeedbackCase> = {}): FeedbackCase {
  const now = new Date("2026-07-09T10:00:00.000Z");
  return {
    id: "case-created",
    title: report.title,
    description: report.description,
    status: "New",
    priority: "High",
    departmentId: "dept-finance",
    customerId: "customer-1",
    sourceSystem: "commerce-platform",
    externalId: "COM-9001",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function makeService() {
  const createManualCase = vi.fn().mockResolvedValue(makeCase());
  const getCaseBySourceExternalId = vi.fn().mockResolvedValue(null);
  const getCaseDetail = vi.fn().mockResolvedValue(null);
  const createEvent = vi.fn().mockResolvedValue({
    id: "event-1",
    caseId: "case-created",
    externalId: report.externalId,
    idempotencyKey: "commerce-platform:COM-9001",
    status: "accepted"
  });
  const markSourceSuccess = vi.fn();
  const markSourceError = vi.fn();
  const findEventByIdempotencyKey = vi.fn().mockResolvedValue(null);

  const service = createIngestionService({
    cases: {
      createManualCase,
      getCaseBySourceExternalId,
      getCaseDetail
    } as never,
    departments: {
      listDepartments: vi.fn().mockResolvedValue([{ id: "dept-finance", key: "finance", name: "Finance" }])
    },
    integrations: {
      findSourceByKey: vi.fn().mockResolvedValue(source),
      listProductSources: vi.fn().mockResolvedValue([]),
      listProductGroups: vi.fn().mockResolvedValue([]),
      updateSourceCallbackConfig: vi.fn(),
      findEventByIdempotencyKey,
      createEvent,
      createCallbackAttempt: vi.fn(),
      markCallbackAttempt: vi.fn(),
      listFailedCallbackAttempts: vi.fn().mockResolvedValue([]),
      markSourceSuccess,
      markSourceError
    }
  });

  return {
    createEvent,
    createManualCase,
    findEventByIdempotencyKey,
    getCaseBySourceExternalId,
    markSourceError,
    markSourceSuccess,
    service
  };
}

describe("ingestion service", () => {
  it("authenticates per-product source secrets", async () => {
    const { service } = makeService();
    const headers = new Headers({
      "x-feedback-source": "commerce-platform",
      "x-feedback-secret": "commerce-secret-123"
    });

    await expect(service.authenticate(headers, "{}")).resolves.toEqual({ ok: true, source });
  });

  it("rejects invalid source secrets", async () => {
    const { service } = makeService();
    const headers = new Headers({
      "x-feedback-source": "commerce-platform",
      "x-feedback-secret": "wrong-secret"
    });

    await expect(service.authenticate(headers, "{}")).resolves.toEqual({ ok: false, reason: "invalid-secret" });
  });

  it("creates a case and integration event for a valid report", async () => {
    const { createEvent, createManualCase, markSourceSuccess, service } = makeService();

    const result = await service.ingestReport(source, report, report);

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        duplicate: false,
        idempotencyKey: "commerce-platform:COM-9001"
      })
    );
    expect(createManualCase).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceSystem: "commerce-platform",
        externalId: "COM-9001",
        departmentId: "dept-finance",
        customer: report.customer
      }),
      undefined
    );
    expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ status: "accepted", caseId: "case-created" }));
    expect(markSourceSuccess).toHaveBeenCalledWith("source-commerce");
  });

  it("returns an existing case for duplicate source reports", async () => {
    const { createManualCase, getCaseBySourceExternalId, service } = makeService();
    getCaseBySourceExternalId.mockResolvedValue(makeCase({ id: "case-existing" }));

    const result = await service.ingestReport(source, report, report);

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        duplicate: true,
        case: expect.objectContaining({ id: "case-existing" })
      })
    );
    expect(createManualCase).not.toHaveBeenCalled();
  });

  it("rejects unknown department keys", async () => {
    const { markSourceError, service } = makeService();

    const result = await service.ingestReport(source, { ...report, departmentKey: "unknown" }, report);

    expect(result).toEqual({ ok: false, status: 400, error: "Unknown department key" });
    expect(markSourceError).toHaveBeenCalledWith("source-commerce", "Unknown department key: unknown");
  });

  it("rejects departments outside the source allow-list", async () => {
    const { markSourceError, service } = makeService();

    const result = await service.ingestReport(
      { ...source, config: { allowedDepartmentKeys: ["research"] } },
      report,
      report
    );

    expect(result).toEqual({ ok: false, status: 400, error: "Department key is not allowed for this source" });
    expect(markSourceError).toHaveBeenCalledWith("source-commerce", "Department key is not allowed: finance");
  });
});
