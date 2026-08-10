import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ingestion/reports/[caseId]/messages/route";
import { createCaseService } from "@/services/cases";
import { createIngestionService } from "@/services/ingestion";

vi.mock("@/services/cases", () => ({
  createCaseService: vi.fn()
}));

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

function request(body: unknown) {
  return new Request("http://localhost/api/ingestion/reports/COM-9001/messages", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

describe("/api/ingestion/reports/[caseId]/messages", () => {
  const authenticate = vi.fn();
  const recordInboundCustomerReplyForSource = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createIngestionService).mockReturnValue({ authenticate } as never);
    vi.mocked(createCaseService).mockReturnValue({ recordInboundCustomerReplyForSource } as never);
  });

  it("requires an authenticated product source", async () => {
    authenticate.mockResolvedValue({ ok: false, reason: "invalid-secret" });

    const response = await POST(request({ channel: "Email", body: "Still broken." }), {
      params: Promise.resolve({ caseId: "COM-9001" })
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized", reason: "invalid-secret" });
    expect(recordInboundCustomerReplyForSource).not.toHaveBeenCalled();
  });

  it("validates inbound message payloads", async () => {
    authenticate.mockResolvedValue({ ok: true, source });

    const response = await POST(request({ channel: "Internal Note", body: "" }), {
      params: Promise.resolve({ caseId: "COM-9001" })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ error: "Invalid inbound message payload" }));
  });

  it("records an inbound customer message for the source-owned case", async () => {
    authenticate.mockResolvedValue({ ok: true, source });
    recordInboundCustomerReplyForSource.mockResolvedValue({
      case: {
        id: "case-1",
        externalId: "COM-9001",
        status: "Reopened"
      },
      reopened: true,
      message: {
        id: "message-1",
        channel: "Email",
        direction: "inbound",
        body: "Still broken.",
        externalMessageId: "email-123",
        createdAt: new Date("2026-08-10T12:00:00.000Z")
      }
    });

    const response = await POST(
      request({
        channel: "Email",
        body: "Still broken.",
        externalMessageId: "email-123",
        customerEmail: "afi@example.com"
      }),
      { params: Promise.resolve({ caseId: "COM-9001" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(recordInboundCustomerReplyForSource).toHaveBeenCalledWith({
      sourceKey: "commerce-platform",
      caseId: "COM-9001",
      channel: "Email",
      body: "Still broken.",
      externalMessageId: "email-123",
      customer: {
        name: undefined,
        email: "afi@example.com",
        phone: undefined
      }
    });
    expect(body).toEqual({
      accepted: true,
      caseId: "case-1",
      externalCaseId: "COM-9001",
      status: "REOPENED",
      reopened: true,
      message: {
        id: "message-1",
        channel: "Email",
        direction: "inbound",
        body: "Still broken.",
        externalMessageId: "email-123",
        createdAt: "2026-08-10T12:00:00.000Z"
      }
    });
  });

  it("returns 404 when the case does not belong to the product source", async () => {
    authenticate.mockResolvedValue({ ok: true, source });
    recordInboundCustomerReplyForSource.mockRejectedValue(new Error("Case was not found for this product source"));

    const response = await POST(request({ channel: "SMS", body: "Hello?" }), {
      params: Promise.resolve({ caseId: "missing" })
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Case was not found for this product source" });
  });
});
