import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser } from "@/domain/types";
import { createAuthService } from "@/services/auth";
import { GET } from "@/app/api/agent-auth/verify/route";

vi.mock("@/services/auth", () => ({
  createAuthService: vi.fn()
}));

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "user-1",
    email: "user@example.com",
    name: "User One",
    roles: ["Product User"],
    departmentIds: ["dept-1"],
    directProductSourceKeys: ["commerce-platform"],
    productSourceKeys: ["commerce-platform"],
    productGroupIds: [],
    provisioned: true,
    ...overrides
  };
}

function request(token?: string) {
  return new Request("http://localhost/api/agent-auth/verify", {
    headers: token ? { authorization: `Bearer ${token}` } : undefined
  });
}

describe("/api/agent-auth/verify", () => {
  const getUserForSession = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createAuthService).mockReturnValue({
      getUserForSession
    } as never);
  });

  it("requires a bearer token", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(getUserForSession).not.toHaveBeenCalled();
  });

  it("rejects invalid or unprovisioned sessions", async () => {
    getUserForSession.mockResolvedValue(makeUser({ provisioned: false }));

    const response = await GET(request("session-token"));

    expect(response.status).toBe(401);
    expect(getUserForSession).toHaveBeenCalledWith("session-token");
  });

  it("requires password change before agent access", async () => {
    getUserForSession.mockResolvedValue(makeUser({ passwordMustChange: true }));

    const response = await GET(request("session-token"));

    expect(response.status).toBe(403);
  });

  it("returns chat-management verify_url user fields", async () => {
    getUserForSession.mockResolvedValue(makeUser({ roles: ["Product Manager"] }));

    const response = await GET(request("session-token"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      user_id: "user-1",
      email: "user@example.com",
      name: "User One",
      roles: ["Product Manager"],
      permissions: ["Product Manager"],
      productSourceKeys: ["commerce-platform"],
      directProductSourceKeys: ["commerce-platform"],
      productGroupIds: []
    });
  });
});
