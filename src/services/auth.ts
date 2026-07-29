import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "argon2";
import type { PrismaClient } from "@prisma/client";
import type { AppUser } from "@/domain/types";
import { prisma } from "@/lib/db";
import { createPrismaUserRepository } from "@/repositories/users";

export const sessionCookieName = "feedback_session";
export const sessionDurationMs = 12 * 60 * 60 * 1000;
export const minimumPasswordLength = 10;

export type AuthResult =
  | {
      ok: true;
      token: string;
      expiresAt: Date;
      user: AppUser;
    }
  | {
      ok: false;
      reason: "invalid-credentials" | "missing-password";
    };

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function assertValidPassword(password: string) {
  if (password.length < minimumPasswordLength) {
    throw new Error(`Password must be at least ${minimumPasswordLength} characters`);
  }
}

export async function hashPassword(password: string) {
  assertValidPassword(password);
  return hash(password, {
    type: 2
  });
}

export async function verifyPassword(passwordHash: string, password: string) {
  return verify(passwordHash, password);
}

export type AuthService = {
  authenticate(email: string, password: string): Promise<AuthResult>;
  changePassword(userId: string, currentPassword: string, nextPassword: string): Promise<void>;
  createSession(userId: string): Promise<{ token: string; expiresAt: Date }>;
  getUserForSession(token: string): Promise<AppUser | null>;
  revokeSession(token: string): Promise<void>;
};

export function createAuthService(client: PrismaClient = prisma): AuthService {
  return {
    async authenticate(email, password) {
      const normalizedEmail = email.trim().toLowerCase();
      const user = await client.user.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          passwordHash: true
        }
      });

      if (!user?.passwordHash) {
        return { ok: false, reason: "missing-password" };
      }

      const passwordMatches = await verifyPassword(user.passwordHash, password);

      if (!passwordMatches) {
        return { ok: false, reason: "invalid-credentials" };
      }

      const session = await this.createSession(user.id);
      await client.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      const appUser = await createPrismaUserRepository(client).getAppUser(user.id);

      if (!appUser) {
        return { ok: false, reason: "invalid-credentials" };
      }

      return {
        ok: true,
        ...session,
        user: appUser
      };
    },

    async changePassword(userId, currentPassword, nextPassword) {
      assertValidPassword(nextPassword);
      const user = await client.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true }
      });

      if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, currentPassword))) {
        throw new Error("Current password is incorrect");
      }

      if (await verifyPassword(user.passwordHash, nextPassword)) {
        throw new Error("New password must be different");
      }

      await client.user.update({
        where: { id: userId },
        data: {
          passwordHash: await hashPassword(nextPassword),
          passwordMustChange: false
        }
      });
    },

    async createSession(userId) {
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + sessionDurationMs);
      await client.userSession.create({
        data: {
          userId,
          tokenHash: hashSessionToken(token),
          expiresAt
        }
      });
      return { token, expiresAt };
    },

    async getUserForSession(token) {
      const session = await client.userSession.findUnique({
        where: { tokenHash: hashSessionToken(token) },
        select: {
          userId: true,
          expiresAt: true,
          revokedAt: true
        }
      });

      if (!session || session.revokedAt || session.expiresAt <= new Date()) {
        return null;
      }

      return createPrismaUserRepository(client).getAppUser(session.userId);
    },

    async revokeSession(token) {
      await client.userSession.updateMany({
        where: {
          tokenHash: hashSessionToken(token),
          revokedAt: null
        },
        data: { revokedAt: new Date() }
      });
    }
  };
}
