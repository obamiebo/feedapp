import type { PrismaClient } from "@prisma/client";
import { roles } from "@/domain/constants";
import type { AppUser, Role } from "@/domain/types";
import { prisma } from "@/lib/db";

export type UserSummary = {
  id: string;
  name: string;
  email: string;
};

export type UserRepository = {
  listAssignableUsers(): Promise<UserSummary[]>;
  listAssignableUsersByProductSourceKey(sourceKey: string): Promise<UserSummary[]>;
  listAppUsersByProductSourceKey(sourceKey: string): Promise<AppUser[]>;
  getAppUser(id: string): Promise<AppUser | null>;
  listAppUsers(): Promise<AppUser[]>;
};

export function createPrismaUserRepository(client: PrismaClient = prisma): UserRepository {
  function toRole(value: string): Role | null {
    return roles.includes(value as Role) ? (value as Role) : null;
  }

  function toAppUser(user: {
    id: string;
    email: string;
    name: string;
    provisioned: boolean;
    passwordMustChange?: boolean;
    memberships: Array<{ departmentId: string }>;
    productAccess?: Array<{ source: { key: string } }>;
    productGroupAccess?: Array<{ groupId: string; group: { sources: Array<{ key: string }> } }>;
    roleAssignments: Array<{ role: { name: string } }>;
    assignedCases: Array<{ id: string }>;
  }): AppUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      provisioned: user.provisioned,
      passwordMustChange: user.passwordMustChange ?? false,
      roles: user.roleAssignments
        .map((assignment) => toRole(assignment.role.name))
        .filter((role): role is Role => role !== null),
      departmentIds: user.memberships.map((membership) => membership.departmentId),
      directProductSourceKeys: (user.productAccess ?? []).map((access) => access.source.key),
      productSourceKeys: Array.from(
        new Set([
          ...(user.productAccess ?? []).map((access) => access.source.key),
          ...(user.productGroupAccess ?? []).flatMap((access) => access.group.sources.map((source) => source.key))
        ])
      ),
      productGroupIds: (user.productGroupAccess ?? []).map((access) => access.groupId),
      assignedCaseIds: user.assignedCases.map((feedbackCase) => feedbackCase.id)
    };
  }

  return {
    listAssignableUsers() {
      return client.user.findMany({
        where: { provisioned: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true
        }
      });
    },

    listAssignableUsersByProductSourceKey(sourceKey) {
      return client.user.findMany({
        where: {
          provisioned: true,
          OR: [
            { productAccess: { some: { source: { key: sourceKey } } } },
            { productGroupAccess: { some: { group: { sources: { some: { key: sourceKey } } } } } }
          ]
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true
        }
      });
    },

    async listAppUsersByProductSourceKey(sourceKey) {
      const users = await client.user.findMany({
        where: {
          provisioned: true,
          OR: [
            { productAccess: { some: { source: { key: sourceKey } } } },
            { productGroupAccess: { some: { group: { sources: { some: { key: sourceKey } } } } } }
          ]
        },
        orderBy: { name: "asc" },
        include: {
          assignedCases: { select: { id: true } },
          memberships: { select: { departmentId: true } },
          productAccess: {
            include: {
              source: { select: { key: true } }
            }
          },
          productGroupAccess: {
            include: {
              group: {
                select: {
                  sources: { select: { key: true } }
                }
              }
            }
          },
          roleAssignments: {
            include: {
              role: { select: { name: true } }
            }
          }
        }
      });

      return users.map(toAppUser);
    },

    async getAppUser(id) {
      const user = await client.user.findUnique({
        where: { id },
        include: {
          assignedCases: { select: { id: true } },
          memberships: { select: { departmentId: true } },
          productAccess: {
            include: {
              source: { select: { key: true } }
            }
          },
          productGroupAccess: {
            include: {
              group: {
                select: {
                  sources: { select: { key: true } }
                }
              }
            }
          },
          roleAssignments: {
            include: {
              role: { select: { name: true } }
            }
          }
        }
      });

      return user ? toAppUser(user) : null;
    },

    async listAppUsers() {
      const users = await client.user.findMany({
        orderBy: { name: "asc" },
        include: {
          assignedCases: { select: { id: true } },
          memberships: { select: { departmentId: true } },
          productAccess: {
            include: {
              source: { select: { key: true } }
            }
          },
          productGroupAccess: {
            include: {
              group: {
                select: {
                  sources: { select: { key: true } }
                }
              }
            }
          },
          roleAssignments: {
            include: {
              role: { select: { name: true } }
            }
          }
        }
      });

      return users.map(toAppUser);
    }
  };
}
