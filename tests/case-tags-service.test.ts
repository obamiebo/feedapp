import { describe, expect, it, vi } from "vitest";
import type { AppUser, FeedbackCase } from "@/domain/types";
import { createCaseTagService } from "@/services/case-tags";

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "user-1",
    email: "user@example.com",
    name: "User",
    roles: ["Product Manager"],
    departmentIds: ["dept-1"],
    directProductSourceKeys: ["commerce-platform"],
    productSourceKeys: ["commerce-platform"],
    productGroupIds: [],
    provisioned: true,
    ...overrides
  };
}

function makeCase(overrides: Partial<FeedbackCase> = {}): FeedbackCase {
  return {
    id: "case-1",
    title: "Checkout failed",
    description: "Customer cannot pay.",
    status: "New",
    priority: "High",
    departmentId: "dept-1",
    customerId: "customer-1",
    sourceSystem: "commerce-platform",
    createdAt: new Date("2026-08-10T10:00:00.000Z"),
    updatedAt: new Date("2026-08-10T10:00:00.000Z"),
    ...overrides
  };
}

describe("case tag service", () => {
  it("allows product managers to create tags for directly managed products", async () => {
    const createTag = vi.fn().mockResolvedValue({
      id: "tag-1",
      sourceKey: "commerce-platform",
      name: "Billing",
      color: "#244f89"
    });
    const service = createCaseTagService({
      tags: {
        listTagsForSource: vi.fn(),
        createTag,
        updateTag: vi.fn(),
        getTag: vi.fn(),
        listCaseTags: vi.fn(),
        assignTag: vi.fn(),
        removeTag: vi.fn()
      },
      cases: { getCaseById: vi.fn() } as never,
      auditLogs: { createAuditLog: vi.fn() }
    });

    await service.createTagForUser(
      { sourceKey: "commerce-platform", name: "Billing", color: "#244f89", description: "Payment issues" },
      makeUser()
    );

    expect(createTag).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceKey: "commerce-platform",
        name: "Billing",
        actorId: "user-1"
      })
    );
  });

  it("allows product managers to create tags for group-scoped products", async () => {
    const createTag = vi.fn().mockResolvedValue({
      id: "tag-1",
      sourceKey: "commerce-platform",
      name: "Billing",
      color: "#244f89"
    });
    const service = createCaseTagService({
      tags: {
        listTagsForSource: vi.fn(),
        createTag,
        updateTag: vi.fn(),
        getTag: vi.fn(),
        listCaseTags: vi.fn(),
        assignTag: vi.fn(),
        removeTag: vi.fn()
      },
      cases: { getCaseById: vi.fn() } as never,
      auditLogs: { createAuditLog: vi.fn() }
    });

    await service.createTagForUser(
      { sourceKey: "commerce-platform", name: "Billing", color: "#244f89" },
      makeUser({ directProductSourceKeys: [], productSourceKeys: ["commerce-platform"], productGroupIds: ["commerce"] })
    );

    expect(createTag).toHaveBeenCalledWith(expect.objectContaining({ sourceKey: "commerce-platform", actorId: "user-1" }));
  });

  it("prevents managing tags for unrelated products", async () => {
    const service = createCaseTagService({
      tags: {
        listTagsForSource: vi.fn(),
        createTag: vi.fn(),
        updateTag: vi.fn(),
        getTag: vi.fn(),
        listCaseTags: vi.fn(),
        assignTag: vi.fn(),
        removeTag: vi.fn()
      },
      cases: { getCaseById: vi.fn() } as never,
      auditLogs: { createAuditLog: vi.fn() }
    });

    await expect(
      service.createTagForUser(
        { sourceKey: "loans-platform", name: "Billing", color: "#244f89" },
        makeUser()
      )
    ).rejects.toThrow("Current user cannot manage tags for this product");
  });

  it("assigns only active tags from the case product", async () => {
    const assignTag = vi.fn().mockResolvedValue(undefined);
    const service = createCaseTagService({
      cases: {
        getCaseById: vi.fn().mockResolvedValue(makeCase())
      } as never,
      tags: {
        listTagsForSource: vi.fn(),
        createTag: vi.fn(),
        updateTag: vi.fn(),
        getTag: vi.fn().mockResolvedValue({
          id: "tag-1",
          sourceKey: "commerce-platform",
          name: "Billing",
          color: "#244f89",
          active: true
        }),
        listCaseTags: vi.fn(),
        assignTag,
        removeTag: vi.fn()
      },
      auditLogs: { createAuditLog: vi.fn() }
    });

    await service.assignTagForUser({ caseId: "case-1", tagId: "tag-1" }, makeUser());

    expect(assignTag).toHaveBeenCalledWith({ caseId: "case-1", tagId: "tag-1", actorId: "user-1" });
  });

  it("rejects tags from a different product", async () => {
    const service = createCaseTagService({
      cases: {
        getCaseById: vi.fn().mockResolvedValue(makeCase())
      } as never,
      tags: {
        listTagsForSource: vi.fn(),
        createTag: vi.fn(),
        updateTag: vi.fn(),
        getTag: vi.fn().mockResolvedValue({
          id: "tag-1",
          sourceKey: "loans-platform",
          name: "Collections",
          color: "#244f89",
          active: true
        }),
        listCaseTags: vi.fn(),
        assignTag: vi.fn(),
        removeTag: vi.fn()
      },
      auditLogs: { createAuditLog: vi.fn() }
    });

    await expect(service.assignTagForUser({ caseId: "case-1", tagId: "tag-1" }, makeUser())).rejects.toThrow(
      "Tag is not available for this case product"
    );
  });
});
