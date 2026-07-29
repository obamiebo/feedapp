import { beforeEach, describe, expect, it, vi } from "vitest";
import { createIngestionService } from "@/services/ingestion";
import { POST } from "@/app/api/ingestion/reports/route";

vi.mock("@/services/ingestion", () => ({
  createIngestionService: vi.fn()
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
  sourceSystem: "commerce-platform",
  externalId: "COM-9001",
  title: "Checkout failed",
  description: "Customer cannot complete checkout.",
  priority: "High",
  departmentKey: "finance",
  customer: {
    email: "afi@example.com"
  }
};

describe("/api/ingestion/reports", () => {
  const authenticate = vi.fn();
  const ingestReport = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createIngestionService).mockReturnValue({
      authenticate,
      ingestReport
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
      idempotencyKey: "commerce-platform:COM-9001",
      caseId: "case-created",
      status: "New",
      priority: "High",
      sourceSystem: "commerce-platform",
      externalId: "COM-9001"
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
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ duplicate: true, caseId: "case-existing" }));
  });
});
