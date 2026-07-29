import type { AppUser } from "@/domain/types";
import { canManageAdmin, canManageAnyProductRoster } from "@/lib/access-control";

export type SettingsHref =
  | "/settings"
  | "/settings/team"
  | "/settings/products"
  | "/settings/messaging"
  | "/settings/operations"
  | "/settings/audit";

export function canAccessSettingsHref(user: AppUser, href: SettingsHref): boolean {
  if (href === "/settings/products") {
    return canManageAdmin(user) || canManageAnyProductRoster(user);
  }

  if (href === "/settings/messaging" || href === "/settings/operations" || href === "/settings/audit") {
    return canManageAdmin(user);
  }

  return user.provisioned;
}

export function visibleSettingsHrefs(user: AppUser, hrefs: SettingsHref[]): SettingsHref[] {
  return hrefs.filter((href) => canAccessSettingsHref(user, href));
}

export function settingsCardDescriptionForUser(
  user: AppUser,
  href: SettingsHref,
  defaultDescription: string
): string {
  if (href === "/settings/team" && !canManageAdmin(user)) {
    return "View your product access, product groups, and teammates in your visible product scope.";
  }

  if (href === "/settings/products" && !canManageAdmin(user)) {
    return "Manage product rosters for products where you have direct Product Manager access.";
  }

  return defaultDescription;
}
