import { describe, expect, it } from "vitest";
import type { AppUser } from "@/domain/types";
import { verifyPassword } from "@/services/auth";
import { createAdminService } from "@/services/admin";

function makeClient() {
  const auditLogs: Array<{ action: string; metadata?: unknown }> = [];
  const createdDepartments: Array<{ key: string; name: string }> = [];
  const createdProductSources: Array<unknown> = [];
  const createdUsers: Array<unknown> = [];
  const roleDeletes: unknown[] = [];
  const roleCreates: unknown[] = [];
  const membershipDeletes: unknown[] = [];
  const membershipCreates: unknown[] = [];
  const productAccessDeletes: unknown[] = [];
  const productAccessCreates: unknown[] = [];
  const productAccessUpserts: unknown[] = [];
  const productGroupAccessDeletes: unknown[] = [];
  const productGroupAccessCreates: unknown[] = [];
  const userUpdates: unknown[] = [];
  const cadenceUpserts: unknown[] = [];
  const slaPolicyFinds: unknown[] = [];
  const slaPolicyUpserts: unknown[] = [];

  const client = {
    auditLog: {
      async create({ data }: { data: { action: string; metadata?: unknown } }) {
        auditLogs.push(data);
      },
      async findMany(input: unknown) {
        auditLogs.push({ action: "audit.findMany", metadata: input });
        return [
          {
            id: "audit-1",
            actorId: "user-admin",
            caseId: "case-1",
            action: "admin.user_access_updated",
            metadata: { userId: "user-rep" },
            createdAt: new Date("2026-07-29T10:00:00.000Z"),
            actor: {
              id: "user-admin",
              name: "Admin User",
              email: "admin@example.com"
            },
            case: {
              id: "case-1",
              title: "Checkout failure",
              sourceSystem: "commerce-platform"
            }
          }
        ];
      }
    },
    department: {
      async create({ data }: { data: { key: string; name: string } }) {
        createdDepartments.push(data);
        return {
          id: "dept-created",
          ...data
        };
      },
      async findFirst() {
        return {
          id: "dept-default",
          key: "support",
          name: "Support"
        };
      },
      async findMany() {
        return [
          {
            id: "dept-default",
            key: "support",
            name: "Support",
            _count: {
              cases: 2,
              members: 3
            }
          }
        ];
      }
    },
    user: {
      async create({ data }: { data: unknown }) {
        createdUsers.push(data);
        return {
          id: "user-created",
          email: "rep@example.com",
          provisioned: true
        };
      },
      async findMany() {
        return [];
      },
      async findUnique({ where }: { where: { email?: string; id?: string } }) {
        if (where.id === "user-pm") {
          return {
            id: "user-pm",
            email: "pm@example.com",
            provisioned: true,
            roleAssignments: [{ role: { name: "Product Manager" } }]
          };
        }

        if (where.email === "rep@example.com") {
          return {
            id: "user-rep",
            email: "rep@example.com",
            provisioned: true
          };
        }

        return null;
      },
      async update(input: unknown) {
        userUpdates.push(input);
      }
    },
    integrationSource: {
      async create({ data }: { data: unknown }) {
        createdProductSources.push(data);
        return {
          id: "source-created",
          key: "commerce-platform",
          name: "Commerce Platform",
          groupId: null,
          enabled: true
        };
      },
      async findUnique({ where }: { where: { id: string } }) {
        if (where.id === "source-commerce-platform") {
          return {
            id: "source-commerce-platform",
            key: "commerce-platform",
            name: "Commerce Platform"
          };
        }

        return null;
      }
    },
    role: {
      async findUnique({ where }: { where: { name: string } }) {
        if (where.name === "Product Manager") {
          return {
            id: "role-product-manager",
            name: "Product Manager"
          };
        }

        return null;
      }
    },
    roleAssignment: {
      async deleteMany(input: unknown) {
        roleDeletes.push(input);
      },
      async createMany(input: unknown) {
        roleCreates.push(input);
      },
      async create(input: unknown) {
        roleCreates.push(input);
      }
    },
    departmentMember: {
      async deleteMany(input: unknown) {
        membershipDeletes.push(input);
      },
      async createMany(input: unknown) {
        membershipCreates.push(input);
      }
    },
    userProductAccess: {
      async deleteMany(input: unknown) {
        productAccessDeletes.push(input);
      },
      async createMany(input: unknown) {
        productAccessCreates.push(input);
      },
      async create(input: unknown) {
        productAccessCreates.push(input);
      },
      async upsert(input: unknown) {
        productAccessUpserts.push(input);
      }
    },
    userProductGroupAccess: {
      async deleteMany(input: unknown) {
        productGroupAccessDeletes.push(input);
      },
      async createMany(input: unknown) {
        productGroupAccessCreates.push(input);
      }
    },
    messagingCadencePolicy: {
      async upsert(input: unknown) {
        cadenceUpserts.push(input);
        return {
          id: "cadence-1",
          status: "IN_PROGRESS",
          priority: "HIGH",
          staleAfterHours: 48,
          enabled: true
        };
      }
    },
    slaPolicy: {
      async findMany(input: unknown) {
        slaPolicyFinds.push(input);
        return [
          {
            departmentId: "dept-default",
            priority: "HIGH",
            responseTargetHours: 2,
            resolutionTargetHours: 24,
            escalationTargetHours: 8,
            department: {
              name: "Support"
            }
          }
        ];
      },
      async upsert(input: unknown) {
        slaPolicyUpserts.push(input);
        return {
          departmentId: "dept-default",
          priority: "HIGH",
          responseTargetHours: 2,
          resolutionTargetHours: 24,
          escalationTargetHours: 8,
          department: {
            name: "Support"
          }
        };
      }
    },
    async $transaction<T>(callback: (transaction: unknown) => Promise<T>) {
      return callback(client);
    }
  };

  return {
    auditLogs,
    client,
    createdDepartments,
    createdProductSources,
    createdUsers,
    cadenceUpserts,
    membershipCreates,
    membershipDeletes,
    productAccessCreates,
    productAccessDeletes,
    productAccessUpserts,
    productGroupAccessCreates,
    productGroupAccessDeletes,
    roleCreates,
    roleDeletes,
    slaPolicyFinds,
    slaPolicyUpserts,
    userUpdates
  };
}

const productManager: AppUser = {
  id: "user-pm",
  email: "pm@example.com",
  name: "Product Manager",
  roles: ["Product Manager"],
  departmentIds: [],
  directProductSourceKeys: ["commerce-platform"],
  productSourceKeys: ["commerce-platform"],
  productGroupIds: [],
  provisioned: true
};

describe("admin service", () => {
  it("creates departments with normalized keys and audit logs", async () => {
    const { auditLogs, client, createdDepartments } = makeClient();

    await createAdminService(client as never).createDepartment({ key: "", name: "Customer Success Team" }, "user-admin");

    expect(createdDepartments).toEqual([
      {
        key: "customer-success-team",
        name: "Customer Success Team"
      }
    ]);
    expect(auditLogs).toEqual([
      expect.objectContaining({
        action: "admin.department_created",
        metadata: expect.objectContaining({
          departmentId: "dept-created",
          key: "customer-success-team"
        })
      })
    ]);
  });

  it("creates users with roles, departments, and audit logs", async () => {
    const { auditLogs, client, createdUsers } = makeClient();

    await createAdminService(client as never).createUser(
      {
        name: "Support Rep",
        email: "REP@EXAMPLE.COM",
        temporaryPassword: "Temporary1!",
        provisioned: true,
        roleIds: ["customer-service"],
        departmentIds: ["dept-finance"],
        productSourceIds: ["source-commerce-platform"],
        productGroupIds: ["group-commerce"]
      },
      "user-admin"
    );

    expect(createdUsers).toEqual([
      expect.objectContaining({
        email: "rep@example.com",
        name: "Support Rep",
        passwordMustChange: true,
        provisioned: true
      })
    ]);
    const created = createdUsers[0] as { passwordHash: string };
    await expect(verifyPassword(created.passwordHash, "Temporary1!")).resolves.toBe(true);
    expect(auditLogs).toEqual([expect.objectContaining({ action: "admin.user_created" })]);
  });

  it("creates product sources with an initial direct product manager", async () => {
    const { auditLogs, client, createdProductSources, productAccessCreates } = makeClient();

    const result = await createAdminService(client as never).createProductSource(
      {
        key: "",
        name: "Commerce Platform",
        type: "api",
        enabled: true,
        initialProductManager: {
          mode: "existing",
          userId: "user-pm"
        }
      },
      "user-admin"
    );

    expect(result).toEqual({
      sourceId: "source-created",
      key: "commerce-platform",
      secret: expect.stringMatching(/^fb_/)
    });
    expect(createdProductSources).toEqual([
      expect.objectContaining({
        key: "commerce-platform",
        name: "Commerce Platform"
      })
    ]);
    expect(productAccessCreates).toEqual([
      {
        data: {
          userId: "user-pm",
          sourceId: "source-created"
        }
      }
    ]);
    expect(auditLogs).toEqual([
      expect.objectContaining({
        action: "admin.product_source_created",
        metadata: expect.objectContaining({
          initialProductManagerId: "user-pm",
          initialProductManagerMode: "existing"
        })
      })
    ]);
  });

  it("creates product sources with a new initial product manager", async () => {
    const { auditLogs, client, createdProductSources, createdUsers, productAccessCreates, roleCreates } = makeClient();

    const result = await createAdminService(client as never).createProductSource(
      {
        key: "",
        name: "Commerce Platform",
        type: "api",
        enabled: true,
        initialProductManager: {
          mode: "create",
          name: "New Product Manager",
          email: "NEW.PM@EXAMPLE.COM",
          temporaryPassword: "Temporary1!"
        }
      },
      "user-admin"
    );

    expect(result).toEqual({
      sourceId: "source-created",
      key: "commerce-platform",
      secret: expect.stringMatching(/^fb_/)
    });
    expect(createdUsers).toEqual([
      expect.objectContaining({
        email: "new.pm@example.com",
        name: "New Product Manager",
        passwordMustChange: true,
        provisioned: true
      })
    ]);
    expect(roleCreates).toContainEqual({
      data: {
        userId: "user-created",
        roleId: "role-product-manager"
      }
    });
    expect(createdProductSources).toEqual([
      expect.objectContaining({
        key: "commerce-platform",
        name: "Commerce Platform"
      })
    ]);
    expect(productAccessCreates).toEqual([
      {
        data: {
          userId: "user-created",
          sourceId: "source-created"
        }
      }
    ]);
    expect(auditLogs).toEqual([
      expect.objectContaining({ action: "admin.user_created" }),
      expect.objectContaining({
        action: "admin.product_source_created",
        metadata: expect.objectContaining({
          initialProductManagerId: "user-created",
          initialProductManagerMode: "create"
        })
      })
    ]);
  });

  it("replaces user roles and department memberships when access changes", async () => {
    const {
      auditLogs,
      client,
      membershipCreates,
      membershipDeletes,
      productAccessCreates,
      productAccessDeletes,
      productGroupAccessCreates,
      productGroupAccessDeletes,
      roleCreates,
      roleDeletes,
      userUpdates
    } = makeClient();

    await createAdminService(client as never).updateUserAccess(
      {
        userId: "user-rep",
        provisioned: false,
        roleIds: ["department-user"],
        departmentIds: ["dept-research"],
        productSourceIds: ["source-commerce-platform"],
        productGroupIds: ["group-commerce"]
      },
      "user-admin"
    );

    expect(userUpdates).toEqual([expect.objectContaining({ where: { id: "user-rep" }, data: { provisioned: false } })]);
    expect(roleDeletes).toEqual([expect.objectContaining({ where: { userId: "user-rep" } })]);
    expect(roleCreates).toEqual([
      expect.objectContaining({
        data: [{ userId: "user-rep", roleId: "department-user" }]
      })
    ]);
    expect(membershipDeletes).toEqual([expect.objectContaining({ where: { userId: "user-rep" } })]);
    expect(membershipCreates).toEqual([
      expect.objectContaining({
        data: [{ userId: "user-rep", departmentId: "dept-research" }]
      })
    ]);
    expect(productAccessDeletes).toEqual([expect.objectContaining({ where: { userId: "user-rep" } })]);
    expect(productAccessCreates).toEqual([
      expect.objectContaining({
        data: [{ userId: "user-rep", sourceId: "source-commerce-platform" }]
      })
    ]);
    expect(productGroupAccessDeletes).toEqual([expect.objectContaining({ where: { userId: "user-rep" } })]);
    expect(productGroupAccessCreates).toEqual([
      expect.objectContaining({
        data: [{ userId: "user-rep", groupId: "group-commerce" }]
      })
    ]);
    expect(auditLogs).toEqual([expect.objectContaining({ action: "admin.user_access_updated" })]);
  });

  it("updates messaging cadence policies and writes audit logs", async () => {
    const { auditLogs, cadenceUpserts, client } = makeClient();

    await createAdminService(client as never).updateMessagingCadence(
      {
        status: "In Progress",
        priority: "High",
        staleAfterHours: 48,
        enabled: true
      },
      "user-admin"
    );

    expect(cadenceUpserts).toEqual([
      expect.objectContaining({
        where: {
          status_priority: {
            status: "IN_PROGRESS",
            priority: "HIGH"
          }
        },
        update: {
          staleAfterHours: 48,
          enabled: true
        }
      })
    ]);
    expect(auditLogs).toEqual([expect.objectContaining({ action: "admin.messaging_cadence_updated" })]);
  });

  it("lists SLA policies with department context", async () => {
    const { client, slaPolicyFinds } = makeClient();

    const directory = await createAdminService(client as never).getSlaDirectory();

    expect(directory.departments).toEqual([
      expect.objectContaining({
        id: "dept-default",
        name: "Support"
      })
    ]);
    expect(slaPolicyFinds).toEqual([
      expect.objectContaining({
        include: {
          department: {
            select: {
              name: true
            }
          }
        }
      })
    ]);
    expect(directory.slaPolicies).toEqual([
      {
        departmentId: "dept-default",
        departmentName: "Support",
        priority: "High",
        responseTargetHours: 2,
        resolutionTargetHours: 24,
        escalationTargetHours: 8
      }
    ]);
  });

  it("updates SLA policies and writes audit logs", async () => {
    const { auditLogs, client, slaPolicyUpserts } = makeClient();

    await createAdminService(client as never).updateSlaPolicy(
      {
        departmentId: "dept-default",
        priority: "High",
        responseTargetHours: 2,
        resolutionTargetHours: 24,
        escalationTargetHours: 8
      },
      "user-admin"
    );

    expect(slaPolicyUpserts).toEqual([
      expect.objectContaining({
        where: {
          departmentId_priority: {
            departmentId: "dept-default",
            priority: "HIGH"
          }
        },
        update: {
          responseTargetHours: 2,
          resolutionTargetHours: 24,
          escalationTargetHours: 8
        }
      })
    ]);
    expect(auditLogs).toEqual([
      expect.objectContaining({
        action: "admin.sla_policy_updated",
        metadata: expect.objectContaining({
          departmentId: "dept-default",
          priority: "High"
        })
      })
    ]);
  });

  it("lists audit logs with actor and case context", async () => {
    const { auditLogs, client } = makeClient();

    const directory = await createAdminService(client as never).getAuditDirectory({
      action: "admin.user_access_updated",
      actorSearch: "admin@example.com",
      limit: 25
    });

    expect(auditLogs).toEqual([
      expect.objectContaining({
        action: "audit.findMany",
        metadata: expect.objectContaining({
          where: {
            action: "admin.user_access_updated",
            actor: {
              OR: [
                { name: { contains: "admin@example.com", mode: "insensitive" } },
                { email: { contains: "admin@example.com", mode: "insensitive" } }
              ]
            },
            OR: undefined
          },
          take: 25
        })
      })
    ]);
    expect(directory.auditLogs).toEqual([
      expect.objectContaining({
        id: "audit-1",
        actorName: "Admin User",
        actorEmail: "admin@example.com",
        caseTitle: "Checkout failure",
        caseSourceSystem: "commerce-platform",
        action: "admin.user_access_updated"
      })
    ]);
  });

  it("does not expose case activity through the admin audit directory", async () => {
    const { auditLogs, client } = makeClient();

    const directory = await createAdminService(client as never).getAuditDirectory({
      action: "case.customer_reply_sent"
    });

    expect(directory.auditLogs).toEqual([]);
    expect(auditLogs).toEqual([]);
  });

  it("limits unfiltered admin audit listings to admin-visible action prefixes", async () => {
    const { auditLogs, client } = makeClient();

    await createAdminService(client as never).getAuditDirectory();

    expect(auditLogs).toEqual([
      expect.objectContaining({
        action: "audit.findMany",
        metadata: expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { action: { startsWith: "admin." } },
              { action: { startsWith: "product_roster." } },
              { action: { startsWith: "operations." } },
              { action: { startsWith: "auth." } },
              { action: { startsWith: "integration." } }
            ]
          })
        })
      })
    ]);
  });

  it("builds scoped team access maps for non-admin product users", async () => {
    const now = new Date("2026-07-29T10:00:00.000Z");
    const client = {
      user: {
        async findMany() {
          return [
            {
              id: "user-pm",
              name: "Product Manager",
              email: "pm@example.com",
              provisioned: true,
              memberships: [],
              productAccess: [{ source: { id: "source-commerce", key: "commerce-platform", name: "Commerce Platform" } }],
              productGroupAccess: [],
              roleAssignments: [{ role: { id: "product-manager", name: "Product Manager" } }]
            },
            {
              id: "user-rep",
              name: "Support Rep",
              email: "rep@example.com",
              provisioned: true,
              memberships: [],
              productAccess: [],
              productGroupAccess: [{ group: { id: "group-commerce", key: "commerce", name: "Commerce" } }],
              roleAssignments: [{ role: { id: "customer-service", name: "Customer Service" } }]
            },
            {
              id: "user-unprovisioned",
              name: "Unprovisioned User",
              email: "blocked@example.com",
              provisioned: false,
              memberships: [],
              productAccess: [{ source: { id: "source-commerce", key: "commerce-platform", name: "Commerce Platform" } }],
              productGroupAccess: [],
              roleAssignments: [{ role: { id: "product-user", name: "Product User" } }]
            },
            {
              id: "user-other",
              name: "Other Product User",
              email: "other@example.com",
              provisioned: true,
              memberships: [],
              productAccess: [{ source: { id: "source-other", key: "other-product", name: "Other Product" } }],
              productGroupAccess: [],
              roleAssignments: [{ role: { id: "product-user", name: "Product User" } }]
            }
          ];
        }
      },
      productGroup: {
        async findMany() {
          return [
            {
              id: "group-commerce",
              key: "commerce",
              name: "Commerce",
              description: "Commerce products",
              _count: { sources: 1 }
            },
            {
              id: "group-other",
              key: "other",
              name: "Other",
              description: null,
              _count: { sources: 1 }
            }
          ];
        }
      },
      integrationSource: {
        async findMany() {
          return [
            {
              id: "source-commerce",
              key: "commerce-platform",
              name: "Commerce Platform",
              type: "REST",
              enabled: true,
              groupId: "group-commerce",
              lastSyncAt: now,
              lastError: null,
              secretHash: "hash",
              config: {},
              _count: { events: 2 }
            },
            {
              id: "source-other",
              key: "other-product",
              name: "Other Product",
              type: "REST",
              enabled: true,
              groupId: "group-other",
              lastSyncAt: null,
              lastError: null,
              secretHash: "hash",
              config: {},
              _count: { events: 1 }
            }
          ];
        }
      }
    };

    const directory = await createAdminService(client as never).getScopedTeamDirectory(productManager);

    expect(directory.productGroups.map((group) => group.id)).toEqual(["group-commerce"]);
    expect(directory.products).toEqual([
      expect.objectContaining({
        id: "source-commerce",
        access: "Direct",
        canManageRoster: true,
        members: [
          expect.objectContaining({ id: "user-pm", direct: true, groupDerived: false, rosterAdmin: true }),
          expect.objectContaining({ id: "user-rep", direct: false, groupDerived: true, rosterAdmin: false })
        ]
      })
    ]);
  });

  it("lets direct product managers add existing provisioned reps to their product roster", async () => {
    const { auditLogs, client, productAccessUpserts } = makeClient();

    await createAdminService(client as never).addProductRosterUser(
      "source-commerce-platform",
      "REP@EXAMPLE.COM",
      productManager
    );

    expect(productAccessUpserts).toEqual([
      expect.objectContaining({
        where: {
          userId_sourceId: {
            userId: "user-rep",
            sourceId: "source-commerce-platform"
          }
        },
        create: {
          userId: "user-rep",
          sourceId: "source-commerce-platform"
        }
      })
    ]);
    expect(auditLogs).toEqual([expect.objectContaining({ action: "product_roster.user_added" })]);
  });

  it("lets direct product managers remove direct roster access from their product", async () => {
    const { auditLogs, client, productAccessDeletes } = makeClient();

    await createAdminService(client as never).removeProductRosterUser(
      "source-commerce-platform",
      "user-rep",
      productManager
    );

    expect(productAccessDeletes).toEqual([
      expect.objectContaining({
        where: {
          sourceId: "source-commerce-platform",
          userId: "user-rep"
        }
      })
    ]);
    expect(auditLogs).toEqual([expect.objectContaining({ action: "product_roster.user_removed" })]);
  });
});
