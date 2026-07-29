import type { Route } from "next";
import type { AppUser } from "@/domain/types";
import { getSessionToken } from "@/lib/session-cookie";
import { createAuthService } from "@/services/auth";

export const defaultCurrentUserId = "user-admin";

export type UserSearchParams = Record<string, string | string[] | undefined>;

function getProvidedUserId(searchParams: UserSearchParams) {
  const value = searchParams.userId;
  return Array.isArray(value) ? value[0] : value;
}

export function getRequestedUserId(searchParams: UserSearchParams) {
  const userId = getProvidedUserId(searchParams);
  return userId || defaultCurrentUserId;
}

export function withUserId(path: string, user: Pick<AppUser, "id">): Route {
  void user;
  return path as Route;
}

export async function resolveCurrentUser(
  searchParams: UserSearchParams = {},
  options: { fallbackToDefault?: boolean } = {}
) {
  void searchParams;
  void options;
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  return createAuthService().getUserForSession(token);
}

export async function listCurrentUserOptions() {
  return [];
}
