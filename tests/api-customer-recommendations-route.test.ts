import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser } from "@/domain/types";
import type { CaseDetail } from "@/repositories/cases";
import { resolveCurrentUser } from "@/lib/current-user";
import { createCaseService } from "@/services/cases";
import { GET } from "@/app/api/customers/[customerId]/recommendations/route";

vi.mock("@/lib/current-user", () => ({
  resolveCurrentUser: vi.fn()
}));

vi.mock("@/services/cases", () => ({
  createCaseService: vi.fn()
}));

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "user-1",
    email: "user@example.com",
    name: "User",
    roles: ["Product User"],
    departmentIds: ["dept-1"],
    directProductSourceKeys: ["commerce-platform"],
    productSourceKeys: ["commerce-platform"],
    productGroupIds: [],
    provisioned: true,
    ...overrides
  };
}

function makeCaseDetail(overrides: Partial<CaseDetail> = {}): CaseDetail {
  const now = new Date("2026-07-28T09:00:00.000Z");

  return {
    id: "case-1",
    title: "Checkout failed",
    description: "Customer cannot complete checkout.",
    status: "New",
    priority: "High",
    departmentId: "dept-1",
    customerId: "customer-1",
    sourceSystem: "commerce-platform",
    createdAt: now,
    updatedAt: now,
    customerName: "Demo Customer",
    departmentName: "Support",
    productName: "Commerce Platform",
    assigneeName: null,
    customer: {
      id: "customer-1",
      externalId: "analytics-customer-1",
      name: "Demo Customer",
      email: "demo@example.com",
      phone: "+233000000000"
    },
    messages: [],
    approvals: [],
    auditLogs: [],
    ...overrides
  };
}

describe("/api/customers/[customerId]/recommendations", () => {
  const getCaseDetailForUser = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createCaseService).mockReturnValue({
      getCaseDetailForUser
    } as never);
  });

  it("requires a provisioned authenticated user", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue(makeUser({ provisioned: false }));

    const response = await GET(new Request("http://localhost/api/customers/customer-1/recommendations?caseId=case-1"), {
      params: Promise.resolve({ customerId: "customer-1" })
    });

    expect(response.status).toBe(401);
    expect(getCaseDetailForUser).not.toHaveBeenCalled();
  });

  it("requires password changes before returning recommendations", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue(makeUser({ passwordMustChange: true }));

    const response = await GET(new Request("http://localhost/api/customers/customer-1/recommendations?caseId=case-1"), {
      params: Promise.resolve({ customerId: "customer-1" })
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Password change required" });
    expect(getCaseDetailForUser).not.toHaveBeenCalled();
  });

  it("requires a scoped case for customer recommendation access", async () => {
    const user = makeUser();
    vi.mocked(resolveCurrentUser).mockResolvedValue(user);
    getCaseDetailForUser.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/customers/customer-1/recommendations?caseId=case-1"), {
      params: Promise.resolve({ customerId: "customer-1" })
    });

    expect(response.status).toBe(403);
    expect(getCaseDetailForUser).toHaveBeenCalledWith("case-1", user);
  });

  it("rejects mismatched customer and case identifiers", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue(makeUser());
    getCaseDetailForUser.mockResolvedValue(makeCaseDetail({ customer: { ...makeCaseDetail().customer, id: "customer-2" } }));

    const response = await GET(new Request("http://localhost/api/customers/customer-1/recommendations?caseId=case-1"), {
      params: Promise.resolve({ customerId: "customer-1" })
    });

    expect(response.status).toBe(403);
  });

  it("returns recommendations for a visible case belonging to the requested customer", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue(makeUser());
    getCaseDetailForUser.mockResolvedValue(makeCaseDetail());

    const response = await GET(new Request("http://localhost/api/customers/customer-1/recommendations?caseId=case-1"), {
      params: Promise.resolve({ customerId: "customer-1" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        customerId: "customer-1",
        staffApprovalRequired: true,
        recommendations: expect.any(Array)
      })
    );
  });
});
