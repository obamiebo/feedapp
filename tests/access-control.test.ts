import { describe, expect, it } from "vitest";
import type { AppUser, FeedbackCase, Role } from "@/domain/types";
import {
  canAssignCase,
  canCreateCase,
  canEnterApplication,
  canEscalateCase,
  canManageProductTags,
  canApproveCustomerReply,
  canManageProductKnowledge,
  canManageProductRoster,
  canManageAdmin,
  canSearchProductKnowledge,
  canRequestCustomerReplyApproval,
  canTransitionCase,
  canViewCase
} from "@/lib/access-control";

const baseCase: FeedbackCase = {
  id: "case-1",
  title: "Issue",
  description: "Description",
  status: "New",
  priority: "Medium",
  departmentId: "dept-1",
  customerId: "customer-1",
  sourceSystem: "manual",
  createdAt: new Date(),
  updatedAt: new Date()
};

const baseUser: AppUser = {
  id: "user-1",
  email: "user@example.com",
  name: "User",
  roles: ["Product User"],
  departmentIds: ["dept-1"],
  directProductSourceKeys: ["manual"],
  productSourceKeys: ["manual"],
  productGroupIds: [],
  provisioned: true
};

function makeUser(input: Partial<AppUser> & { roles?: Role[] } = {}): AppUser {
  return {
    ...baseUser,
    ...input,
    roles: input.roles ?? baseUser.roles
  };
}

describe("access control", () => {
  it("denies valid SSO users who are not provisioned", () => {
    expect(canEnterApplication({ provisioned: false })).toBe(false);
    expect(canViewCase({ ...baseUser, provisioned: false }, baseCase)).toBe(false);
  });

  it("allows product-scoped users to see only granted product cases", () => {
    expect(canViewCase(baseUser, baseCase)).toBe(true);
    expect(canViewCase(baseUser, { ...baseCase, sourceSystem: "other-product" })).toBe(false);
  });

  it("allows product managers to escalate cases", () => {
    expect(canEscalateCase({ ...baseUser, roles: ["Product Manager"] })).toBe(true);
    expect(canEscalateCase(baseUser)).toBe(false);
  });

  it("restricts case creation and admin management by role", () => {
    expect(canCreateCase({ ...baseUser, roles: ["Customer Service"] })).toBe(true);
    expect(canCreateCase({ ...baseUser, roles: ["Admin"] })).toBe(false);
    expect(canCreateCase(baseUser)).toBe(false);
    expect(canManageAdmin({ ...baseUser, roles: ["Admin"] })).toBe(true);
    expect(canManageAdmin({ ...baseUser, roles: ["Customer Service"] })).toBe(false);
  });

  it("restricts close and reopen transitions to customer service", () => {
    expect(canTransitionCase(baseUser, baseCase, "Assigned")).toBe(true);
    expect(canTransitionCase(baseUser, baseCase, "Closed")).toBe(false);
    expect(canTransitionCase({ ...baseUser, roles: ["Customer Service"] }, baseCase, "Closed")).toBe(true);
    expect(canTransitionCase({ ...baseUser, roles: ["Admin"] }, baseCase, "Closed")).toBe(false);
  });

  it("limits customer reply approval to product managers with case access", () => {
    expect(canApproveCustomerReply(baseUser, baseCase)).toBe(false);
    expect(canApproveCustomerReply({ ...baseUser, roles: ["Product Manager"] }, baseCase)).toBe(true);
    expect(canApproveCustomerReply({ ...baseUser, roles: ["Admin"] }, baseCase)).toBe(false);
    expect(canApproveCustomerReply({ ...baseUser, roles: ["Product Manager"] }, { ...baseCase, sourceSystem: "other-product" })).toBe(false);
  });

  it("allows product-scoped users to assign cases they can view", () => {
    expect(canAssignCase(baseUser, baseCase)).toBe(true);
    expect(canAssignCase(baseUser, { ...baseCase, sourceSystem: "other-product" })).toBe(false);
  });

  it("limits product roster management to admins or direct product managers", () => {
    expect(canManageProductRoster({ ...baseUser, roles: ["Admin"], directProductSourceKeys: [] }, "manual")).toBe(true);
    expect(canManageProductRoster({ ...baseUser, roles: ["Product Manager"] }, "manual")).toBe(true);
    expect(
      canManageProductRoster(
        { ...baseUser, roles: ["Product Manager"], directProductSourceKeys: [], productSourceKeys: ["manual"] },
        "manual"
      )
    ).toBe(false);
    expect(canManageProductRoster(baseUser, "manual")).toBe(false);
  });

  it("limits product knowledge management while allowing scoped search", () => {
    expect(canManageProductKnowledge({ ...baseUser, roles: ["Admin"], directProductSourceKeys: [] }, "manual")).toBe(true);
    expect(canManageProductKnowledge({ ...baseUser, roles: ["Product Manager"] }, "manual")).toBe(true);
    expect(
      canManageProductKnowledge(
        { ...baseUser, roles: ["Product Manager"], directProductSourceKeys: [], productSourceKeys: ["manual"] },
        "manual"
      )
    ).toBe(false);
    expect(canManageProductKnowledge(baseUser, "manual")).toBe(false);
    expect(canSearchProductKnowledge(baseUser, "manual")).toBe(true);
    expect(canSearchProductKnowledge(baseUser, "other-product")).toBe(false);
  });

  it("allows product managers to manage tags for products in their visible scope", () => {
    expect(canManageProductTags({ ...baseUser, roles: ["Admin"], productSourceKeys: [] }, "manual")).toBe(true);
    expect(
      canManageProductTags(
        { ...baseUser, roles: ["Product Manager"], directProductSourceKeys: [], productSourceKeys: ["manual"] },
        "manual"
      )
    ).toBe(true);
    expect(canManageProductTags({ ...baseUser, roles: ["Product Manager"], productSourceKeys: ["manual"] }, "other-product")).toBe(false);
    expect(canManageProductTags(baseUser, "manual")).toBe(false);
  });

  it("keeps admin configuration separate from case operations", () => {
    const admin = makeUser({ roles: ["Admin"], directProductSourceKeys: [], productSourceKeys: ["manual"] });

    expect(canManageAdmin(admin)).toBe(true);
    expect(canViewCase(admin, baseCase)).toBe(false);
    expect(canCreateCase(admin)).toBe(false);
    expect(canTransitionCase(admin, baseCase, "Assigned")).toBe(false);
    expect(canRequestCustomerReplyApproval(admin, baseCase)).toBe(false);
    expect(canApproveCustomerReply(admin, baseCase)).toBe(false);
  });

  it("captures the go-live role capability matrix", () => {
    const customerService = makeUser({ roles: ["Customer Service"] });
    const productManager = makeUser({ roles: ["Product Manager"] });
    const productUser = makeUser({ roles: ["Product User"] });
    const unprovisioned = makeUser({ roles: ["Customer Service"], provisioned: false });

    expect({
      view: canViewCase(customerService, baseCase),
      create: canCreateCase(customerService),
      close: canTransitionCase(customerService, baseCase, "Closed"),
      requestReplyApproval: canRequestCustomerReplyApproval(customerService, baseCase),
      approveReply: canApproveCustomerReply(customerService, baseCase),
      manageRoster: canManageProductRoster(customerService, "manual")
    }).toEqual({
      view: true,
      create: true,
      close: true,
      requestReplyApproval: true,
      approveReply: false,
      manageRoster: false
    });

    expect({
      view: canViewCase(productManager, baseCase),
      create: canCreateCase(productManager),
      close: canTransitionCase(productManager, baseCase, "Closed"),
      requestReplyApproval: canRequestCustomerReplyApproval(productManager, baseCase),
      approveReply: canApproveCustomerReply(productManager, baseCase),
      manageRoster: canManageProductRoster(productManager, "manual")
    }).toEqual({
      view: true,
      create: false,
      close: false,
      requestReplyApproval: true,
      approveReply: true,
      manageRoster: true
    });

    expect({
      view: canViewCase(productUser, baseCase),
      create: canCreateCase(productUser),
      close: canTransitionCase(productUser, baseCase, "Closed"),
      requestReplyApproval: canRequestCustomerReplyApproval(productUser, baseCase),
      approveReply: canApproveCustomerReply(productUser, baseCase),
      manageRoster: canManageProductRoster(productUser, "manual")
    }).toEqual({
      view: true,
      create: false,
      close: false,
      requestReplyApproval: true,
      approveReply: false,
      manageRoster: false
    });

    expect({
      enter: canEnterApplication(unprovisioned),
      view: canViewCase(unprovisioned, baseCase),
      create: canCreateCase(unprovisioned),
      requestReplyApproval: canRequestCustomerReplyApproval(unprovisioned, baseCase),
      approveReply: canApproveCustomerReply(unprovisioned, baseCase),
      manageRoster: canManageProductRoster(unprovisioned, "manual")
    }).toEqual({
      enter: false,
      view: false,
      create: false,
      requestReplyApproval: false,
      approveReply: false,
      manageRoster: false
    });
  });
});
