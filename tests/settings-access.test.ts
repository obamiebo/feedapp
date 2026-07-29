import { describe, expect, it } from "vitest";
import type { AppUser, Role } from "@/domain/types";
import {
  canAccessSettingsHref,
  settingsCardDescriptionForUser,
  visibleSettingsHrefs,
  type SettingsHref
} from "@/lib/settings-access";

const allSettingsHrefs: SettingsHref[] = [
  "/settings",
  "/settings/team",
  "/settings/products",
  "/settings/messaging",
  "/settings/operations",
  "/settings/audit"
];

const baseUser: AppUser = {
  id: "user-1",
  email: "user@example.com",
  name: "User",
  roles: ["Customer Service"],
  departmentIds: [],
  directProductSourceKeys: ["commerce-platform"],
  productSourceKeys: ["commerce-platform"],
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

describe("settings access", () => {
  it("allows admins to access every settings configuration section", () => {
    const admin = makeUser({ roles: ["Admin"], directProductSourceKeys: [] });

    expect(visibleSettingsHrefs(admin, allSettingsHrefs)).toEqual(allSettingsHrefs);
    expect(canAccessSettingsHref(admin, "/settings/messaging")).toBe(true);
    expect(canAccessSettingsHref(admin, "/settings/operations")).toBe(true);
    expect(canAccessSettingsHref(admin, "/settings/audit")).toBe(true);
  });

  it("hides admin-only configuration from customer service reps", () => {
    expect(visibleSettingsHrefs(baseUser, allSettingsHrefs)).toEqual(["/settings", "/settings/team"]);
    expect(canAccessSettingsHref(baseUser, "/settings/products")).toBe(false);
    expect(canAccessSettingsHref(baseUser, "/settings/messaging")).toBe(false);
    expect(canAccessSettingsHref(baseUser, "/settings/operations")).toBe(false);
    expect(canAccessSettingsHref(baseUser, "/settings/audit")).toBe(false);
  });

  it("hides settings sections from unprovisioned users", () => {
    const unprovisioned = makeUser({ provisioned: false });

    expect(visibleSettingsHrefs(unprovisioned, allSettingsHrefs)).toEqual([]);
    for (const href of allSettingsHrefs) {
      expect(canAccessSettingsHref(unprovisioned, href)).toBe(false);
    }
  });

  it("lets direct product managers manage product rosters without exposing platform configuration", () => {
    const productManager = makeUser({ roles: ["Product Manager"], directProductSourceKeys: ["commerce-platform"] });

    expect(visibleSettingsHrefs(productManager, allSettingsHrefs)).toEqual([
      "/settings",
      "/settings/team",
      "/settings/products"
    ]);
    expect(canAccessSettingsHref(productManager, "/settings/messaging")).toBe(false);
    expect(canAccessSettingsHref(productManager, "/settings/operations")).toBe(false);
    expect(canAccessSettingsHref(productManager, "/settings/audit")).toBe(false);
  });

  it("does not show product settings to product managers with only group-derived access", () => {
    const groupDerivedProductManager = makeUser({
      roles: ["Product Manager"],
      directProductSourceKeys: [],
      productSourceKeys: ["commerce-platform"],
      productGroupIds: ["group-commerce"]
    });

    expect(visibleSettingsHrefs(groupDerivedProductManager, allSettingsHrefs)).toEqual(["/settings", "/settings/team"]);
    expect(canAccessSettingsHref(groupDerivedProductManager, "/settings/products")).toBe(false);
  });

  it("uses scoped descriptions for non-admin visible settings cards", () => {
    const productManager = makeUser({ roles: ["Product Manager"], directProductSourceKeys: ["commerce-platform"] });

    expect(settingsCardDescriptionForUser(productManager, "/settings/team", "default")).toContain("visible product scope");
    expect(settingsCardDescriptionForUser(productManager, "/settings/products", "default")).toContain("direct Product Manager access");
    expect(settingsCardDescriptionForUser(makeUser({ ...productManager, roles: ["Admin"] }), "/settings/products", "default")).toBe(
      "default"
    );
  });
});
