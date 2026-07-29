import { describe, expect, it } from "vitest";
import { createAuthService, hashPassword, verifyPassword } from "@/services/auth";

function makeClient() {
  const sessions = new Map<string, { userId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null }>();
  const user = {
    id: "user-admin",
    email: "admin@example.com",
    name: "Platform Admin",
    passwordHash: "",
    passwordMustChange: true,
    provisioned: true,
    memberships: [{ departmentId: "dept-finance" }],
    roleAssignments: [{ role: { name: "Admin" } }],
    assignedCases: []
  };

  const client = {
    user: {
      async findUnique(input: { where: { email?: string; id?: string }; select?: Record<string, boolean> }) {
        const matchesUser = input.where.email === user.email || input.where.id === user.id;
        if (!matchesUser) return null;
        if (input.select?.passwordHash && input.select?.id) {
          return { id: user.id, passwordHash: user.passwordHash };
        }
        if (input.select?.passwordHash) {
          return { passwordHash: user.passwordHash };
        }
        return user;
      },
      async update(input: { data: { passwordHash?: string; passwordMustChange?: boolean; lastLoginAt?: Date } }) {
        if (input.data.passwordHash) user.passwordHash = input.data.passwordHash;
        if (typeof input.data.passwordMustChange === "boolean") user.passwordMustChange = input.data.passwordMustChange;
        return user;
      }
    },
    userSession: {
      async create(input: { data: { userId: string; tokenHash: string; expiresAt: Date } }) {
        sessions.set(input.data.tokenHash, { ...input.data, revokedAt: null });
      },
      async findUnique(input: { where: { tokenHash: string } }) {
        return sessions.get(input.where.tokenHash) ?? null;
      },
      async updateMany(input: { where: { tokenHash: string }; data: { revokedAt: Date } }) {
        const session = sessions.get(input.where.tokenHash);
        if (session) session.revokedAt = input.data.revokedAt;
      }
    }
  };

  return { client, user };
}

describe("auth service", () => {
  it("hashes and verifies passwords", async () => {
    const passwordHash = await hashPassword("Temporary1!");

    await expect(verifyPassword(passwordHash, "Temporary1!")).resolves.toBe(true);
    await expect(verifyPassword(passwordHash, "wrong-password")).resolves.toBe(false);
  });

  it("authenticates users and creates session-backed app users", async () => {
    const { client } = makeClient();
    const service = createAuthService(client as never);
    await client.user.update({ data: { passwordHash: await hashPassword("Temporary1!") } });

    const result = await service.authenticate("ADMIN@EXAMPLE.COM", "Temporary1!");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.token).toBeTruthy();
      expect(result.user).toEqual(
        expect.objectContaining({
          id: "user-admin",
          roles: ["Admin"],
          passwordMustChange: true
        })
      );
    }
  });

  it("returns null for revoked sessions", async () => {
    const { client } = makeClient();
    const service = createAuthService(client as never);
    const session = await service.createSession("user-admin");

    await expect(service.getUserForSession(session.token)).resolves.toEqual(expect.objectContaining({ id: "user-admin" }));

    await service.revokeSession(session.token);

    await expect(service.getUserForSession(session.token)).resolves.toBeNull();
  });

  it("changes passwords and clears the temporary password requirement", async () => {
    const { client, user } = makeClient();
    const service = createAuthService(client as never);
    user.passwordHash = await hashPassword("Temporary1!");

    await service.changePassword("user-admin", "Temporary1!", "Permanent1!");

    expect(user.passwordMustChange).toBe(false);
    await expect(verifyPassword(user.passwordHash, "Permanent1!")).resolves.toBe(true);
  });

  it("rejects reusing the temporary password as the new password", async () => {
    const { client, user } = makeClient();
    const service = createAuthService(client as never);
    user.passwordHash = await hashPassword("Temporary1!");

    await expect(service.changePassword("user-admin", "Temporary1!", "Temporary1!")).rejects.toThrow(
      "New password must be different"
    );
    expect(user.passwordMustChange).toBe(true);
  });
});
