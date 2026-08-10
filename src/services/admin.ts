import type { Prisma, PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import type { CaseStatus, Priority } from "@/domain/types";
import type { AppUser } from "@/domain/types";
import { prisma } from "@/lib/db";
import { canManageProductRoster, canManageProductTags } from "@/lib/access-control";
import { hashIntegrationSecret } from "@/lib/integrations";
import { normalizeKey } from "@/lib/keys";
import { getProductCallbackConfig, getProductExternalEntryConfig } from "@/repositories/integrations";
import type { MessagingCadencePolicyRecord } from "@/repositories/messaging-cadence";
import { createPrismaMessagingCadenceRepository } from "@/repositories/messaging-cadence";
import type { AuditLogListFilters, AuditLogListRecord } from "@/repositories/audit-logs";
import { createPrismaAuditLogRepository } from "@/repositories/audit-logs";
import type { SlaPolicyRecord } from "@/repositories/sla-policies";
import { createPrismaSlaPolicyRepository } from "@/repositories/sla-policies";
import { hashPassword } from "@/services/auth";

export type AdminDepartment = {
  id: string;
  key: string;
  name: string;
  memberCount: number;
  caseCount: number;
};

export type AdminRole = {
  id: string;
  name: string;
};

export type AdminProductGroup = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  productCount: number;
};

export type AdminProductSource = {
  id: string;
  key: string;
  name: string;
  type: string;
  enabled: boolean;
  groupId: string | null;
  lastSyncAt: Date | null;
  lastError: string | null;
  eventCount: number;
  hasSecret: boolean;
  callbackConfigured: boolean;
  externalEntryConfigured: boolean;
  externalEntryIssuer: string | null;
  externalEntryTokenTtlSeconds: number;
  externalEntryAllowedOrigins: string[];
  externalEntryAllowedModes: Array<"portal" | "embed">;
};

export type ProductRosterSource = AdminProductSource & {
  canManageRoster: boolean;
  canManageTags: boolean;
};

export type ProductRosterMember = {
  id: string;
  name: string;
  email: string;
  roles: AdminRole[];
  direct: boolean;
  groupDerived: boolean;
};

export type ProductRosterDirectory = {
  productSources: ProductRosterSource[];
  selectedSource: ProductRosterSource | null;
  members: ProductRosterMember[];
};

export type ScopedTeamProductMember = {
  id: string;
  name: string;
  email: string;
  roles: AdminRole[];
  direct: boolean;
  groupDerived: boolean;
  rosterAdmin: boolean;
};

export type ScopedTeamProduct = AdminProductSource & {
  access: "Direct" | "Group";
  canManageRoster: boolean;
  members: ScopedTeamProductMember[];
};

export type ScopedTeamDirectory = {
  actor: AdminUser | null;
  productGroups: AdminProductGroup[];
  products: ScopedTeamProduct[];
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  provisioned: boolean;
  roles: AdminRole[];
  departments: Array<{
    id: string;
    key: string;
    name: string;
  }>;
  productSources: Array<{
    id: string;
    key: string;
    name: string;
  }>;
  productGroups: Array<{
    id: string;
    key: string;
    name: string;
  }>;
};

export type AdminDirectory = {
  departments: AdminDepartment[];
  messagingCadence: MessagingCadencePolicyRecord[];
  productGroups: AdminProductGroup[];
  productSources: AdminProductSource[];
  roles: AdminRole[];
  users: AdminUser[];
};

export type AdminProductsDirectory = {
  productGroups: AdminProductGroup[];
  productSources: AdminProductSource[];
};

export type AdminTeamDirectory = {
  departments: AdminDepartment[];
  users: AdminUser[];
  roles: AdminRole[];
  productGroups: AdminProductGroup[];
  productSources: AdminProductSource[];
};

export type AdminMessagingDirectory = {
  messagingCadence: MessagingCadencePolicyRecord[];
};

export type AdminAuditDirectory = {
  auditLogs: AuditLogListRecord[];
};

export type AdminSlaDirectory = {
  departments: AdminDepartment[];
  slaPolicies: SlaPolicyRecord[];
};

const ADMIN_AUDIT_ACTION_PREFIXES = ["admin.", "product_roster.", "operations.", "auth.", "integration."];

export type CreateDepartmentInput = {
  key: string;
  name: string;
};

export type CreateUserInput = {
  name: string;
  email: string;
  temporaryPassword: string;
  provisioned: boolean;
  roleIds: string[];
  departmentIds: string[];
  productSourceIds: string[];
  productGroupIds: string[];
};

export type UpdateUserAccessInput = {
  userId: string;
  provisioned: boolean;
  roleIds: string[];
  departmentIds: string[];
  productSourceIds: string[];
  productGroupIds: string[];
};

export type CreateProductGroupInput = {
  key: string;
  name: string;
  description?: string;
};

export type UpdateProductGroupInput = {
  groupId: string;
  name: string;
  description?: string;
  productSourceIds: string[];
};

export type CreateProductSourceInput = {
  key: string;
  name: string;
  type: string;
  groupId?: string;
  enabled: boolean;
  initialProductManager:
    | {
        mode: "existing";
        userId: string;
      }
    | {
        mode: "create";
        name: string;
        email: string;
        temporaryPassword: string;
      };
};

export type UpdateProductSourceInput = {
  sourceId: string;
  name: string;
  type: string;
  groupId?: string;
  enabled: boolean;
};

export type ProductSecretResult = {
  sourceId: string;
  key: string;
  secret: string;
};

export type ProductExternalEntrySecretResult = {
  sourceId: string;
  key: string;
  entrySecret: string | null;
};

export type UpdateProductExternalEntryInput = {
  sourceId: string;
  enabled: boolean;
  issuer: string;
  tokenTtlSeconds: number;
  allowedOrigins: string[];
  allowedModes: Array<"portal" | "embed">;
  rotateSecret?: boolean;
};

export type UpdateMessagingCadenceInput = {
  status: CaseStatus;
  priority: Priority;
  staleAfterHours: number;
  enabled: boolean;
};

export type UpdateSlaPolicyInput = {
  departmentId: string;
  priority: Priority;
  responseTargetHours: number;
  resolutionTargetHours: number;
  escalationTargetHours: number;
};

function configObject(config: Prisma.JsonValue): Record<string, Prisma.InputJsonValue> {
  return config && typeof config === "object" && !Array.isArray(config)
    ? ({ ...(config as Record<string, Prisma.InputJsonValue>) } as Record<string, Prisma.InputJsonValue>)
    : {};
}

function normalizeAllowedModes(modes: Array<"portal" | "embed">) {
  const unique = Array.from(new Set(modes.filter((mode) => mode === "portal" || mode === "embed")));
  return unique.length > 0 ? unique : ["embed"];
}

function normalizeAllowedOrigins(origins: string[]) {
  return Array.from(new Set(origins.map((origin) => origin.trim()).filter(Boolean)));
}

async function writeAuditLog(
  client: AuditWriter,
  input: { actorId?: string; action: string; metadata?: Prisma.InputJsonObject }
) {
  await client.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      metadata: input.metadata
    }
  });
}

async function fetchDepartments(client: PrismaClient): Promise<AdminDepartment[]> {
  const departments = await client.department.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          cases: true,
          members: true
        }
      }
    }
  });

  return departments.map((department) => ({
    id: department.id,
    key: department.key,
    name: department.name,
    caseCount: department._count.cases,
    memberCount: department._count.members
  }));
}

async function fetchProductGroups(client: PrismaClient): Promise<AdminProductGroup[]> {
  const productGroups = await client.productGroup.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { sources: true }
      }
    }
  });

  return productGroups.map((group) => ({
    id: group.id,
    key: group.key,
    name: group.name,
    description: group.description,
    productCount: group._count.sources
  }));
}

async function fetchProductSources(client: PrismaClient): Promise<AdminProductSource[]> {
  const productSources = await client.integrationSource.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { events: true }
      }
    }
  });

  return productSources.map((source) => {
    const callbackConfig = getProductCallbackConfig(source.config);
    const externalEntryConfig = getProductExternalEntryConfig(source.config);

    return {
      id: source.id,
      key: source.key,
      name: source.name,
      type: source.type,
      enabled: source.enabled,
      groupId: source.groupId,
      lastSyncAt: source.lastSyncAt,
      lastError: source.lastError,
      eventCount: source._count.events,
      hasSecret: Boolean(source.secretHash),
      callbackConfigured: Boolean(callbackConfig.url && callbackConfig.secret),
      externalEntryConfigured: Boolean(
        externalEntryConfig.enabled && externalEntryConfig.issuer && externalEntryConfig.secret
      ),
      externalEntryIssuer: externalEntryConfig.issuer,
      externalEntryTokenTtlSeconds: externalEntryConfig.tokenTtlSeconds,
      externalEntryAllowedOrigins: externalEntryConfig.allowedOrigins,
      externalEntryAllowedModes: externalEntryConfig.allowedModes
    };
  });
}

async function fetchRoles(client: PrismaClient): Promise<AdminRole[]> {
  return client.role.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true
    }
  });
}

async function fetchUsersWithAccess(client: PrismaClient): Promise<AdminUser[]> {
  const users = await client.user.findMany({
    orderBy: { name: "asc" },
    include: {
      memberships: {
        include: {
          department: {
            select: {
              id: true,
              key: true,
              name: true
            }
          }
        }
      },
      productAccess: {
        include: {
          source: {
            select: {
              id: true,
              key: true,
              name: true
            }
          }
        }
      },
      productGroupAccess: {
        include: {
          group: {
            select: {
              id: true,
              key: true,
              name: true
            }
          }
        }
      },
      roleAssignments: {
        include: {
          role: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  });

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    provisioned: user.provisioned,
    departments: user.memberships.map((membership) => membership.department),
    productSources: user.productAccess.map((access) => access.source),
    productGroups: user.productGroupAccess.map((access) => access.group),
    roles: user.roleAssignments.map((assignment) => assignment.role)
  }));
}

export type AdminService = {
  getDirectory(): Promise<AdminDirectory>;
  getProductsDirectory(): Promise<AdminProductsDirectory>;
  getTeamDirectory(): Promise<AdminTeamDirectory>;
  getScopedTeamDirectory(actor: AppUser): Promise<ScopedTeamDirectory>;
  getMessagingDirectory(): Promise<AdminMessagingDirectory>;
  getAuditDirectory(filters?: AuditLogListFilters): Promise<AdminAuditDirectory>;
  getSlaDirectory(): Promise<AdminSlaDirectory>;
  getProductRosterDirectory(actor: AppUser, sourceId?: string): Promise<ProductRosterDirectory>;
  createDepartment(input: CreateDepartmentInput, actorId?: string): Promise<void>;
  deleteDepartment(departmentId: string, actorId?: string): Promise<void>;
  createProductGroup(input: CreateProductGroupInput, actorId?: string): Promise<void>;
  updateProductGroup(input: UpdateProductGroupInput, actorId?: string): Promise<void>;
  createProductSource(input: CreateProductSourceInput, actorId?: string): Promise<ProductSecretResult>;
  updateProductSource(input: UpdateProductSourceInput, actorId?: string): Promise<void>;
  rotateProductSourceSecret(sourceId: string, actorId?: string): Promise<ProductSecretResult>;
  updateProductSourceCallback(input: { sourceId: string; callbackUrl?: string; callbackSecret?: string }, actorId?: string): Promise<void>;
  updateProductExternalEntry(
    input: UpdateProductExternalEntryInput,
    actorId?: string
  ): Promise<ProductExternalEntrySecretResult>;
  addProductRosterUser(sourceId: string, email: string, actor: AppUser): Promise<void>;
  removeProductRosterUser(sourceId: string, userId: string, actor: AppUser): Promise<void>;
  createUser(input: CreateUserInput, actorId?: string): Promise<void>;
  updateMessagingCadence(input: UpdateMessagingCadenceInput, actorId?: string): Promise<void>;
  updateSlaPolicy(input: UpdateSlaPolicyInput, actorId?: string): Promise<void>;
  updateUserAccess(input: UpdateUserAccessInput, actorId?: string): Promise<void>;
};

export function createAdminService(client: PrismaClient = prisma): AdminService {
  return {
    async getDirectory() {
      const [departments, productGroups, productSources, roles, users, messagingCadence] = await Promise.all([
        fetchDepartments(client),
        fetchProductGroups(client),
        fetchProductSources(client),
        fetchRoles(client),
        fetchUsersWithAccess(client),
        createPrismaMessagingCadenceRepository(client).listPolicies()
      ]);

      return { departments, productGroups, productSources, roles, users, messagingCadence };
    },

    async getProductsDirectory() {
      const [productGroups, productSources] = await Promise.all([
        fetchProductGroups(client),
        fetchProductSources(client)
      ]);

      return { productGroups, productSources };
    },

    async getTeamDirectory() {
      const [departments, users, roles, productGroups, productSources] = await Promise.all([
        fetchDepartments(client),
        fetchUsersWithAccess(client),
        fetchRoles(client),
        fetchProductGroups(client),
        fetchProductSources(client)
      ]);

      return { departments, users, roles, productGroups, productSources };
    },

    async getScopedTeamDirectory(actor) {
      const [users, productGroups, productSources] = await Promise.all([
        fetchUsersWithAccess(client),
        fetchProductGroups(client),
        fetchProductSources(client)
      ]);
      const actorRecord = users.find((user) => user.id === actor.id) ?? null;
      const visibleSourceKeys = new Set(actor.productSourceKeys);
      const visibleProducts = productSources.filter((source) => visibleSourceKeys.has(source.key));
      const visibleProductGroupIds = new Set([
        ...actor.productGroupIds,
        ...visibleProducts.map((source) => source.groupId).filter((groupId): groupId is string => Boolean(groupId))
      ]);

      return {
        actor: actorRecord,
        productGroups: productGroups.filter((group) => visibleProductGroupIds.has(group.id)),
        products: visibleProducts.map((source) => {
          const canManageRosterForSource = canManageProductRoster(actor, source.key);
          const members = users
            .filter((user) => {
              if (!user.provisioned) return false;
              const hasDirectAccess = user.productSources.some((access) => access.id === source.id);
              const hasGroupAccess = source.groupId
                ? user.productGroups.some((group) => group.id === source.groupId)
                : false;
              return hasDirectAccess || hasGroupAccess;
            })
            .map((user) => {
              const direct = user.productSources.some((access) => access.id === source.id);
              const groupDerived = source.groupId
                ? user.productGroups.some((group) => group.id === source.groupId)
                : false;

              return {
                id: user.id,
                name: user.name,
                email: user.email,
                roles: user.roles,
                direct,
                groupDerived,
                rosterAdmin:
                  user.roles.some((role) => role.name === "Admin") ||
                  (direct && user.roles.some((role) => role.name === "Product Manager"))
              };
            });

          return {
            ...source,
            access: actor.directProductSourceKeys.includes(source.key) ? "Direct" : "Group",
            canManageRoster: canManageRosterForSource,
            members
          };
        })
      };
    },

    async getMessagingDirectory() {
      const messagingCadence = await createPrismaMessagingCadenceRepository(client).listPolicies();
      return { messagingCadence };
    },

    async getAuditDirectory(filters) {
      const auditRepository = createPrismaAuditLogRepository(client);
      if (!auditRepository.listAuditLogs) {
        throw new Error("Audit log listing is not available");
      }
      if (filters?.action && !ADMIN_AUDIT_ACTION_PREFIXES.some((prefix) => filters.action?.startsWith(prefix))) {
        return { auditLogs: [] };
      }

      const auditLogs = await auditRepository.listAuditLogs({
        ...filters,
        actionPrefixes: ADMIN_AUDIT_ACTION_PREFIXES
      });
      return { auditLogs };
    },

    async getSlaDirectory() {
      const slaRepository = createPrismaSlaPolicyRepository(client);
      if (!slaRepository.listPolicies) {
        throw new Error("SLA policy listing is not available");
      }
      const [departments, slaPolicies] = await Promise.all([fetchDepartments(client), slaRepository.listPolicies()]);
      return { departments, slaPolicies };
    },

    async getProductRosterDirectory(actor, sourceId) {
      const productSources = (await fetchProductSources(client)).map((source) => ({
        ...source,
        canManageRoster: canManageProductRoster(actor, source.key),
        canManageTags: canManageProductTags(actor, source.key)
      }));
      const manageableSources = productSources.filter((source) => source.canManageRoster || source.canManageTags);
      const selectedSource =
        productSources.find(
          (source) => (source.id === sourceId || source.key === sourceId) && (source.canManageRoster || source.canManageTags)
        ) ??
        manageableSources[0] ??
        null;

      if (!selectedSource) {
        return {
          productSources,
          selectedSource: null,
          members: []
        };
      }

      const users = await client.user.findMany({
        where: {
          provisioned: true,
          OR: [
            { productAccess: { some: { sourceId: selectedSource.id } } },
            { productGroupAccess: { some: { group: { sources: { some: { id: selectedSource.id } } } } } }
          ]
        },
        orderBy: { name: "asc" },
        include: {
          productAccess: {
            where: { sourceId: selectedSource.id },
            select: { id: true }
          },
          productGroupAccess: {
            where: { group: { sources: { some: { id: selectedSource.id } } } },
            select: { id: true }
          },
          roleAssignments: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      });

      return {
        productSources,
        selectedSource,
        members: users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          roles: user.roleAssignments.map((assignment) => assignment.role),
          direct: user.productAccess.length > 0,
          groupDerived: user.productGroupAccess.length > 0
        }))
      };
    },

    async updateMessagingCadence(input, actorId) {
      const policy = await createPrismaMessagingCadenceRepository(client).upsertPolicy({
        status: input.status,
        priority: input.priority,
        staleAfterHours: Math.max(1, Math.round(input.staleAfterHours)),
        enabled: input.enabled
      });

      await writeAuditLog(client, {
        actorId,
        action: "admin.messaging_cadence_updated",
        metadata: {
          status: policy.status,
          priority: policy.priority,
          staleAfterHours: policy.staleAfterHours,
          enabled: policy.enabled
        }
      });
    },

    async updateSlaPolicy(input, actorId) {
      if (
        !input.departmentId ||
        input.responseTargetHours < 1 ||
        input.resolutionTargetHours < 1 ||
        input.escalationTargetHours < 1
      ) {
        throw new Error("Valid SLA policy targets are required");
      }

      const slaRepository = createPrismaSlaPolicyRepository(client);
      if (!slaRepository.upsertPolicy) {
        throw new Error("SLA policy updates are not available");
      }
      const policy = await slaRepository.upsertPolicy({
        departmentId: input.departmentId,
        priority: input.priority,
        responseTargetHours: Math.max(1, Math.round(input.responseTargetHours)),
        resolutionTargetHours: Math.max(1, Math.round(input.resolutionTargetHours)),
        escalationTargetHours: Math.max(1, Math.round(input.escalationTargetHours))
      });

      await writeAuditLog(client, {
        actorId,
        action: "admin.sla_policy_updated",
        metadata: {
          departmentId: policy.departmentId,
          departmentName: policy.departmentName,
          priority: policy.priority,
          responseTargetHours: policy.responseTargetHours,
          resolutionTargetHours: policy.resolutionTargetHours,
          escalationTargetHours: policy.escalationTargetHours
        }
      });
    },

    async createDepartment(input, actorId) {
      const key = normalizeKey(input.key || input.name);

      if (!key) {
        throw new Error("Department key is required");
      }

      const department = await client.department.create({
        data: {
          key,
          name: input.name.trim()
        }
      });

      await writeAuditLog(client, {
        actorId,
        action: "admin.department_created",
        metadata: {
          departmentId: department.id,
          key: department.key,
          name: department.name
        }
      });
    },

    async deleteDepartment(departmentId, actorId) {
      const department = await client.department.findUnique({
        where: { id: departmentId },
        include: {
          _count: {
            select: {
              cases: true,
              members: true
            }
          }
        }
      });

      if (!department) {
        throw new Error("Department was not found");
      }

      if (department._count.cases > 0 || department._count.members > 0) {
        throw new Error("Department must have no members or cases before deletion");
      }

      await client.department.delete({
        where: { id: departmentId }
      });

      await writeAuditLog(client, {
        actorId,
        action: "admin.department_deleted",
        metadata: {
          departmentId: department.id,
          key: department.key,
          name: department.name
        }
      });
    },

    async createProductGroup(input, actorId) {
      const key = normalizeKey(input.key || input.name);

      if (!key) {
        throw new Error("Product group key is required");
      }

      const group = await client.productGroup.create({
        data: {
          key,
          name: input.name.trim(),
          description: input.description?.trim() || null
        }
      });

      await writeAuditLog(client, {
        actorId,
        action: "admin.product_group_created",
        metadata: {
          groupId: group.id,
          key: group.key,
          name: group.name
        }
      });
    },

    async updateProductGroup(input, actorId) {
      if (!input.groupId || input.name.trim().length < 2) {
        throw new Error("Product group and name are required");
      }

      const selectedProductSourceIds = [...new Set(input.productSourceIds.filter(Boolean))];

      const group = await client.$transaction(async (transaction) => {
        const updatedGroup = await transaction.productGroup.update({
          where: { id: input.groupId },
          data: {
            name: input.name.trim(),
            description: input.description?.trim() || null
          }
        });

        await transaction.integrationSource.updateMany({
          where: {
            groupId: input.groupId,
            ...(selectedProductSourceIds.length > 0 ? { id: { notIn: selectedProductSourceIds } } : {})
          },
          data: {
            groupId: null
          }
        });

        if (selectedProductSourceIds.length > 0) {
          await transaction.integrationSource.updateMany({
            where: { id: { in: selectedProductSourceIds } },
            data: {
              groupId: input.groupId
            }
          });
        }

        return updatedGroup;
      });

      await writeAuditLog(client, {
        actorId,
        action: "admin.product_group_updated",
        metadata: {
          groupId: group.id,
          key: group.key,
          name: group.name,
          productSourceIds: selectedProductSourceIds
        }
      });
    },

    async createProductSource(input, actorId) {
      const key = normalizeKey(input.key || input.name);

      if (!key) {
        throw new Error("Product key is required");
      }

      if (input.initialProductManager.mode === "existing" && !input.initialProductManager.userId) {
        throw new Error("An initial Product Manager is required");
      }

      const defaultDepartment = await client.department.findFirst({ orderBy: { name: "asc" } });

      if (!defaultDepartment) {
        throw new Error("A legacy routing department is required before creating product sources");
      }

      let existingManagerId: string | null = null;
      let newManagerRoleId: string | null = null;

      if (input.initialProductManager.mode === "existing") {
        const initialManager = await client.user.findUnique({
          where: { id: input.initialProductManager.userId },
          include: {
            roleAssignments: {
              include: {
                role: {
                  select: { name: true }
                }
              }
            }
          }
        });

        if (
          !initialManager?.provisioned ||
          !initialManager.roleAssignments.some((assignment) => assignment.role.name === "Product Manager")
        ) {
          throw new Error("Initial product manager must be a provisioned Product Manager");
        }

        existingManagerId = initialManager.id;
      } else {
        const managerName = input.initialProductManager.name.trim();
        const managerEmail = input.initialProductManager.email.trim().toLowerCase();

        if (
          managerName.length < 2 ||
          !managerEmail.includes("@") ||
          input.initialProductManager.temporaryPassword.length < 10
        ) {
          throw new Error("Product Manager name, email, and a temporary password of at least 10 characters are required");
        }

        const existingUser = await client.user.findUnique({ where: { email: managerEmail } });

        if (existingUser) {
          throw new Error("Product Manager email already belongs to an existing user");
        }

        const productManagerRole = await client.role.findUnique({ where: { name: "Product Manager" } });

        if (!productManagerRole) {
          throw new Error("Product Manager role is required before creating product sources");
        }

        newManagerRoleId = productManagerRole.id;
      }

      const secret = `fb_${randomBytes(24).toString("base64url")}`;
      const source = await client.$transaction(async (transaction) => {
        let initialProductManagerId = existingManagerId;

        if (input.initialProductManager.mode === "create") {
          if (!newManagerRoleId) {
            throw new Error("Product Manager role is required before creating product sources");
          }

          const manager = await transaction.user.create({
            data: {
              email: input.initialProductManager.email.trim().toLowerCase(),
              name: input.initialProductManager.name.trim(),
              passwordHash: await hashPassword(input.initialProductManager.temporaryPassword),
              passwordMustChange: true,
              provisioned: true
            }
          });

          await transaction.roleAssignment.create({
            data: {
              userId: manager.id,
              roleId: newManagerRoleId
            }
          });

          await writeAuditLog(transaction, {
            actorId,
            action: "admin.user_created",
            metadata: {
              userId: manager.id,
              email: manager.email,
              provisioned: true,
              passwordMustChange: true,
              roleIds: [newManagerRoleId],
              departmentIds: [],
              productSourceIds: [],
              productGroupIds: []
            }
          });

          initialProductManagerId = manager.id;
        }

        if (!initialProductManagerId) {
          throw new Error("An initial Product Manager is required");
        }

        const created = await transaction.integrationSource.create({
          data: {
            key,
            name: input.name.trim(),
            type: input.type.trim() || "api",
            enabled: input.enabled,
            secretHash: hashIntegrationSecret(secret),
            groupId: input.groupId || null,
            config: {
              endpoint: "/api/ingestion/reports",
              sourceHeader: "x-feedback-source",
              secretHeader: "x-feedback-secret",
              defaultDepartmentKey: defaultDepartment.key
            }
          }
        });

        await transaction.userProductAccess.create({
          data: {
            userId: initialProductManagerId,
            sourceId: created.id
          }
        });

        await writeAuditLog(transaction, {
          actorId,
          action: "admin.product_source_created",
          metadata: {
            sourceId: created.id,
            key: created.key,
            name: created.name,
            groupId: created.groupId,
            enabled: created.enabled,
            initialProductManagerId,
            initialProductManagerMode: input.initialProductManager.mode
          }
        });

        return created;
      });

      return {
        sourceId: source.id,
        key: source.key,
        secret
      };
    },

    async updateProductSource(input, actorId) {
      const source = await client.integrationSource.update({
        where: { id: input.sourceId },
        data: {
          name: input.name.trim(),
          type: input.type.trim() || "api",
          groupId: input.groupId || null,
          enabled: input.enabled
        }
      });

      await writeAuditLog(client, {
        actorId,
        action: "admin.product_source_updated",
        metadata: {
          sourceId: source.id,
          key: source.key,
          name: source.name,
          groupId: source.groupId,
          enabled: source.enabled
        }
      });
    },

    async rotateProductSourceSecret(sourceId, actorId) {
      const secret = `fb_${randomBytes(24).toString("base64url")}`;
      const source = await client.integrationSource.update({
        where: { id: sourceId },
        data: {
          secretHash: hashIntegrationSecret(secret),
          lastError: null
        }
      });

      await writeAuditLog(client, {
        actorId,
        action: "admin.product_source_secret_rotated",
        metadata: {
          sourceId: source.id,
          key: source.key
        }
      });

      return {
        sourceId: source.id,
        key: source.key,
        secret
      };
    },

    async updateProductSourceCallback(input, actorId) {
      const source = await client.integrationSource.findUnique({
        where: { id: input.sourceId },
        select: { id: true, key: true, config: true }
      });

      if (!source) {
        throw new Error("Product source was not found");
      }

      const nextConfig =
        source.config && typeof source.config === "object" && !Array.isArray(source.config)
          ? ({ ...(source.config as Record<string, Prisma.InputJsonValue>) } as Record<string, Prisma.InputJsonValue>)
          : {};
      const callbackUrl = input.callbackUrl?.trim() ?? "";
      const callbackSecret = input.callbackSecret?.trim() ?? "";

      if (callbackUrl) {
        nextConfig.callbackUrl = callbackUrl;
      } else {
        delete nextConfig.callbackUrl;
      }

      if (callbackSecret) {
        nextConfig.callbackSecret = callbackSecret;
      } else {
        delete nextConfig.callbackSecret;
      }

      await client.integrationSource.update({
        where: { id: source.id },
        data: { config: nextConfig as Prisma.InputJsonObject }
      });

      await writeAuditLog(client, {
        actorId,
        action: "admin.product_source_callback_updated",
        metadata: {
          sourceId: source.id,
          key: source.key,
          callbackConfigured: Boolean(callbackUrl && callbackSecret)
        }
      });
    },

    async updateProductExternalEntry(input, actorId) {
      const source = await client.integrationSource.findUnique({
        where: { id: input.sourceId },
        select: { id: true, key: true, config: true }
      });

      if (!source) {
        throw new Error("Product source was not found");
      }

      const nextConfig = configObject(source.config);
      const currentEntryConfig = getProductExternalEntryConfig(source.config);
      const issuer = input.issuer.trim();
      const tokenTtlSeconds = Number.isFinite(input.tokenTtlSeconds) && input.tokenTtlSeconds > 0
        ? Math.floor(input.tokenTtlSeconds)
        : 300;
      const allowedOrigins = normalizeAllowedOrigins(input.allowedOrigins);
      const allowedModes = normalizeAllowedModes(input.allowedModes);
      const shouldGenerateSecret = input.enabled && (!currentEntryConfig.secret || input.rotateSecret);
      const entrySecret = shouldGenerateSecret ? `fe_embed_${randomBytes(24).toString("base64url")}` : null;

      if (input.enabled) {
        if (!issuer) {
          throw new Error("External entry issuer is required");
        }

        nextConfig.externalEntry = {
          enabled: true,
          issuer,
          secret: entrySecret ?? currentEntryConfig.secret,
          tokenTtlSeconds,
          allowedOrigins,
          allowedModes
        };
      } else {
        nextConfig.externalEntry = {
          enabled: false,
          issuer: issuer || currentEntryConfig.issuer || "",
          tokenTtlSeconds,
          allowedOrigins,
          allowedModes
        };
      }

      await client.integrationSource.update({
        where: { id: source.id },
        data: { config: nextConfig as Prisma.InputJsonObject }
      });

      await writeAuditLog(client, {
        actorId,
        action: "admin.product_source_external_entry_updated",
        metadata: {
          sourceId: source.id,
          key: source.key,
          enabled: input.enabled,
          issuer: issuer || null,
          secretRotated: Boolean(entrySecret),
          tokenTtlSeconds,
          allowedOriginCount: allowedOrigins.length,
          allowedModes
        }
      });

      return {
        sourceId: source.id,
        key: source.key,
        entrySecret
      };
    },

    async addProductRosterUser(sourceId, email, actor) {
      const source = await client.integrationSource.findUnique({
        where: { id: sourceId },
        select: { id: true, key: true, name: true }
      });

      if (!source || !canManageProductRoster(actor, source.key)) {
        throw new Error("Current user cannot manage this product roster");
      }

      const user = await client.user.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: { id: true, provisioned: true, email: true }
      });

      if (!user || !user.provisioned) {
        throw new Error("Rep must be an existing provisioned user");
      }

      await client.userProductAccess.upsert({
        where: {
          userId_sourceId: {
            userId: user.id,
            sourceId: source.id
          }
        },
        update: {},
        create: {
          userId: user.id,
          sourceId: source.id
        }
      });

      await writeAuditLog(client, {
        actorId: actor.id,
        action: "product_roster.user_added",
        metadata: {
          sourceId: source.id,
          sourceKey: source.key,
          userId: user.id,
          email: user.email
        }
      });
    },

    async removeProductRosterUser(sourceId, userId, actor) {
      const source = await client.integrationSource.findUnique({
        where: { id: sourceId },
        select: { id: true, key: true, name: true }
      });

      if (!source || !canManageProductRoster(actor, source.key)) {
        throw new Error("Current user cannot manage this product roster");
      }

      await client.userProductAccess.deleteMany({
        where: {
          sourceId: source.id,
          userId
        }
      });

      await writeAuditLog(client, {
        actorId: actor.id,
        action: "product_roster.user_removed",
        metadata: {
          sourceId: source.id,
          sourceKey: source.key,
          userId
        }
      });
    },

    async createUser(input, actorId) {
      const user = await client.user.create({
        data: {
          email: input.email.trim().toLowerCase(),
          name: input.name.trim(),
          passwordHash: await hashPassword(input.temporaryPassword),
          passwordMustChange: true,
          provisioned: input.provisioned,
          roleAssignments: {
            create: input.roleIds.map((roleId) => ({
              roleId
            }))
          },
          memberships: {
            create: input.departmentIds.map((departmentId) => ({
              departmentId
            }))
          },
          productAccess: {
            create: input.productSourceIds.map((sourceId) => ({
              sourceId
            }))
          },
          productGroupAccess: {
            create: input.productGroupIds.map((groupId) => ({
              groupId
            }))
          }
        }
      });

      await writeAuditLog(client, {
        actorId,
        action: "admin.user_created",
        metadata: {
          userId: user.id,
          email: user.email,
          provisioned: user.provisioned,
          passwordMustChange: true,
          roleIds: input.roleIds,
          departmentIds: input.departmentIds,
          productSourceIds: input.productSourceIds,
          productGroupIds: input.productGroupIds
        }
      });
    },

    async updateUserAccess(input, actorId) {
      await client.$transaction(async (transaction) => {
        await transaction.user.update({
          where: { id: input.userId },
          data: { provisioned: input.provisioned }
        });

        await transaction.roleAssignment.deleteMany({
          where: { userId: input.userId }
        });

        if (input.roleIds.length > 0) {
          await transaction.roleAssignment.createMany({
            data: input.roleIds.map((roleId) => ({
              userId: input.userId,
              roleId
            })),
            skipDuplicates: true
          });
        }

        await transaction.departmentMember.deleteMany({
          where: { userId: input.userId }
        });

        if (input.departmentIds.length > 0) {
          await transaction.departmentMember.createMany({
            data: input.departmentIds.map((departmentId) => ({
              userId: input.userId,
              departmentId
            })),
            skipDuplicates: true
          });
        }

        await transaction.userProductAccess.deleteMany({
          where: { userId: input.userId }
        });

        if (input.productSourceIds.length > 0) {
          await transaction.userProductAccess.createMany({
            data: input.productSourceIds.map((sourceId) => ({
              userId: input.userId,
              sourceId
            })),
            skipDuplicates: true
          });
        }

        await transaction.userProductGroupAccess.deleteMany({
          where: { userId: input.userId }
        });

        if (input.productGroupIds.length > 0) {
          await transaction.userProductGroupAccess.createMany({
            data: input.productGroupIds.map((groupId) => ({
              userId: input.userId,
              groupId
            })),
            skipDuplicates: true
          });
        }

        await writeAuditLog(transaction, {
          actorId,
          action: "admin.user_access_updated",
          metadata: {
            userId: input.userId,
            provisioned: input.provisioned,
            roleIds: input.roleIds,
            departmentIds: input.departmentIds,
            productSourceIds: input.productSourceIds,
            productGroupIds: input.productGroupIds
          }
        });
      });
    }
  };
}
type AuditWriter = {
  auditLog: {
    create(input: { data: { actorId?: string; action: string; metadata?: Prisma.InputJsonObject } }): Promise<unknown>;
  };
};
