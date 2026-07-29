import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser, FeedbackCase } from "@/domain/types";
import { resolveCurrentUser } from "@/lib/current-user";
import { createCaseService } from "@/services/cases";
import { GET, POST } from "@/app/api/cases/route";

vi.mock("@/lib/current-user", () => ({
  resolveCurrentUser: vi.fn()
}));

vi.mock("@/services/cases", () => ({
  createCaseService: vi.fn()
}));

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "user-cs-1",
    email: "cs@example.com",
    name: "Customer Service",
    roles: ["Customer Service"],
    departmentIds: ["dept-finance"],
    directProductSourceKeys: ["manual"],
    productSourceKeys: ["manual"],
    productGroupIds: [],
    provisioned: true,
    ...overrides
  };
}

function makeCase(overrides: Partial<FeedbackCase> = {}): FeedbackCase {
  const now = new Date("2026-07-07T12:00:00.000Z");

  return {
    id: "case-1",
    title: "Checkout failure",
    description: "Customer cannot complete checkout.",
    status: "New",
    priority: "High",
    departmentId: "dept-finance",
    customerId: "customer-1",
    sourceSystem: "manual",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("/api/cases", () => {
  const listCasesPageForUser = vi.fn();
  const createCaseForUser = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createCaseService).mockReturnValue({
      listCasesPageForUser,
      createCaseForUser
    } as never);
  });

  it("requires an explicit valid API user", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/cases"));

    expect(response.status).toBe(401);
    expect(resolveCurrentUser).toHaveBeenCalledWith();
    expect(listCasesPageForUser).not.toHaveBeenCalled();
  });

  it("requires users with temporary passwords to change them before using case APIs", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue(makeUser({ passwordMustChange: true }));

    const response = await GET(new Request("http://localhost/api/cases"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Password change required" });
    expect(listCasesPageForUser).not.toHaveBeenCalled();
  });

  it("lists only cases visible to the resolved user and forwards filters with pagination", async () => {
    const user = makeUser();
    const cases = [makeCase()];
    vi.mocked(resolveCurrentUser).mockResolvedValue(user);
    listCasesPageForUser.mockResolvedValue({
      items: cases,
      total: 18,
      page: 2,
      pageSize: 10,
      pageCount: 2
    });

    const response = await GET(new Request("http://localhost/api/cases?search=checkout&slaState=on-track&page=2&pageSize=10"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.cases).toHaveLength(1);
    expect(body.cases[0]).toEqual(
      expect.objectContaining({
        id: "case-1",
        title: "Checkout failure",
        createdAt: "2026-07-07T12:00:00.000Z",
        updatedAt: "2026-07-07T12:00:00.000Z"
      })
    );
    expect(body.pagination).toEqual({
      total: 18,
      page: 2,
      pageSize: 10,
      pageCount: 2
    });
    expect(listCasesPageForUser).toHaveBeenCalledWith(user, {
      status: undefined,
      priority: undefined,
      departmentId: undefined,
      assigneeId: undefined,
      sourceSystem: undefined,
      slaState: "on-track",
      search: "checkout",
      page: 2,
      pageSize: 10
    });
  });

  it("denies case creation for users without case creation permission", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue(makeUser({ roles: ["Product User"] }));

    const response = await POST(
      new Request("http://localhost/api/cases", {
        method: "POST",
        body: JSON.stringify({
          title: "Manual report",
          description: "Customer called the support desk.",
          priority: "High",
          departmentId: "dept-finance",
          customerId: "customer-1",
          sourceSystem: "manual"
        })
      })
    );

    expect(response.status).toBe(401);
    expect(createCaseForUser).not.toHaveBeenCalled();
  });

  it("denies case APIs to authenticated users who are not provisioned", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue(makeUser({ provisioned: false }));

    const response = await GET(new Request("http://localhost/api/cases"));

    expect(response.status).toBe(401);
    expect(listCasesPageForUser).not.toHaveBeenCalled();
  });

  it("returns forbidden when the service rejects crafted product scope", async () => {
    const user = makeUser({ productSourceKeys: ["manual"] });
    vi.mocked(resolveCurrentUser).mockResolvedValue(user);
    createCaseForUser.mockRejectedValue(new Error("Current user cannot create cases for this product"));

    const response = await POST(
      new Request("http://localhost/api/cases", {
        method: "POST",
        body: JSON.stringify({
          title: "Manual report",
          description: "Customer called the support desk.",
          priority: "High",
          departmentId: "dept-finance",
          customerId: "customer-1",
          sourceSystem: "other-product"
        })
      })
    );

    expect(response.status).toBe(403);
    expect(createCaseForUser).toHaveBeenCalledWith(
      expect.objectContaining({ sourceSystem: "other-product" }),
      user
    );
  });

  it("creates cases with the resolved user as the audit actor", async () => {
    const user = makeUser();
    const created = makeCase({ id: "case-created" });
    vi.mocked(resolveCurrentUser).mockResolvedValue(user);
    createCaseForUser.mockResolvedValue(created);

    const response = await POST(
      new Request("http://localhost/api/cases", {
        method: "POST",
        body: JSON.stringify({
          title: "Manual report",
          description: "Customer called the support desk.",
          priority: "High",
          departmentId: "dept-finance",
          customerId: "customer-1",
          sourceSystem: "manual"
        })
      })
    );

    expect(response.status).toBe(201);
    expect(createCaseForUser).toHaveBeenCalledWith(
      {
        title: "Manual report",
        description: "Customer called the support desk.",
        priority: "High",
        departmentId: "dept-finance",
        customerId: "customer-1",
        sourceSystem: "manual"
      },
      user
    );
  });
});
