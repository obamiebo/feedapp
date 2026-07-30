import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPrismaCaseRepository } from "@/repositories/cases";
import { createIngestionService } from "@/services/ingestion";
import { GET, POST } from "@/app/api/ingestion/reports/route";

vi.mock("@/services/ingestion", () => ({
  createIngestionService: vi.fn()
}));

vi.mock("@/repositories/cases", () => ({
  createPrismaCaseRepository: vi.fn()
}));

const source = {
  id: "source-commerce",
  key: "commerce-platform",
  name: "Commerce Platform",
  enabled: true,
  secretHash: "hash",
  config: {}
};

const payload = {
  caseID: "COM-9001",
  customerID: "customer-9001",
  title: "Checkout failed",
  description: "Customer cannot complete checkout.",
  priority: "High",
  departmentKey: "finance",
  customerEmail: "afi@example.com"
};

describe("/api/ingestion/reports", () => {
  const authenticate = vi.fn();
  const ingestReport = vi.fn();
  const listProductReports = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createIngestionService).mockReturnValue({
      authenticate,
      ingestReport
    } as never);
    vi.mocked(createPrismaCaseRepository).mockReturnValue({
      listProductReports
    } as never);
  });

  it("requires an authenticated integration source", async () => {
    authenticate.mockResolvedValue({ ok: false, reason: "invalid-secret" });

    const response = await POST(
      new Request("http://localhost/api/ingestion/reports", {
        method: "POST",
        body: JSON.stringify(payload)
      })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized", reason: "invalid-secret" });
    expect(ingestReport).not.toHaveBeenCalled();
  });

  it("creates a case and returns a compact case reference", async () => {
    authenticate.mockResolvedValue({ ok: true, source });
    ingestReport.mockResolvedValue({
      ok: true,
      duplicate: false,
      idempotencyKey: "commerce-platform:COM-9001",
      case: {
        id: "case-created",
        status: "New",
        priority: "High",
        sourceSystem: "commerce-platform",
        externalId: "COM-9001"
      }
    });

    const response = await POST(
      new Request("http://localhost/api/ingestion/reports", {
        method: "POST",
        body: JSON.stringify(payload)
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      accepted: true,
      duplicate: false,
      caseID: "COM-9001",
      customerID: "customer-9001",
      status: "NEW",
      priority: "High"
    });
    expect(ingestReport).toHaveBeenCalledWith(source, payload, payload);
  });

  it("returns 200 for duplicate reports with the existing case reference", async () => {
    authenticate.mockResolvedValue({ ok: true, source });
    ingestReport.mockResolvedValue({
      ok: true,
      duplicate: true,
      idempotencyKey: "commerce-platform:COM-9001",
      case: {
        id: "case-existing",
        status: "Assigned",
        priority: "High",
        sourceSystem: "commerce-platform",
        externalId: "COM-9001"
      }
    });

    const response = await POST(
      new Request("http://localhost/api/ingestion/reports", {
        method: "POST",
        body: JSON.stringify(payload)
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ duplicate: true, caseID: "COM-9001", status: "ASSIGNED" })
    );
  });

  it("lists reports for the authenticated product source", async () => {
    authenticate.mockResolvedValue({ ok: true, source });
    listProductReports.mockResolvedValue({
      reports: [
        {
          caseID: "COM-9001",
          customerID: "customer-9001",
          title: "Checkout failed",
          description: "Customer cannot complete checkout.",
          status: "IN_PROGRESS",
          priority: "High",
          customerName: "Afi Mensah",
          customerEmail: "afi@example.com",
          customerPhone: null,
          createdAt: new Date("2026-07-30T08:00:00.000Z"),
          updatedAt: new Date("2026-07-30T09:00:00.000Z")
        }
      ],
      nextCursor: "case-created"
    });

    const response = await GET(
      new Request(
        "http://localhost/api/ingestion/reports?status=IN_PROGRESS&customerID=customer-9001&from=2026-07-01T00:00:00.000Z&limit=25"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listProductReports).toHaveBeenCalledWith({
      sourceSystem: "commerce-platform",
      caseID: undefined,
      customerID: "customer-9001",
      status: "IN_PROGRESS",
      from: new Date("2026-07-01T00:00:00.000Z"),
      to: undefined,
      limit: 25,
      cursor: undefined
    });
    expect(body).toEqual({
      reports: [
        {
          caseID: "COM-9001",
          customerID: "customer-9001",
          title: "Checkout failed",
          description: "Customer cannot complete checkout.",
          status: "IN_PROGRESS",
          priority: "High",
          customerName: "Afi Mensah",
          customerEmail: "afi@example.com",
          customerPhone: null,
          createdAt: "2026-07-30T08:00:00.000Z",
          updatedAt: "2026-07-30T09:00:00.000Z"
        }
      ],
      nextCursor: "case-created"
    });
  });
});
