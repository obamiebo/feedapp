import type {
  Approval,
  AuditLog,
  Case,
  CaseStatus as PrismaCaseStatus,
  Message,
  Prisma,
  PrismaClient,
  Priority as PrismaPriority
} from "@prisma/client";
import type { AppUser, CaseStatus, FeedbackCase, Priority } from "@/domain/types";
import { caseStatuses, priorities } from "@/domain/constants";
import { mapCaseStatusFromPrisma, mapCaseStatusToPrisma, mapPriorityFromPrisma, mapPriorityToPrisma } from "@/lib/domain-mappers";
import { prisma } from "@/lib/db";
import { canEnterApplication, hasRole } from "@/lib/access-control";

export type CaseListItem = FeedbackCase & {
  customerName: string | null;
  departmentName: string;
  productName: string | null;
  assigneeName: string | null;
  tags?: Array<{ id: string; name: string; color: string }>;
};

export type CaseSlaState = "on-track" | "at-risk" | "breached";

export type CaseListFilters = {
  status?: CaseStatus;
  priority?: Priority;
  departmentId?: string;
  assigneeId?: string;
  sourceSystem?: string;
  sourceSystems?: string[];
  productGroupId?: string;
  tagId?: string;
  slaState?: CaseSlaState;
  search?: string;
};

export type CaseListQuery = CaseListFilters & {
  page?: number;
  pageSize?: number;
};

export type CaseListPage = {
  items: CaseListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type ProductReportStatus = "NEW" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "REOPENED";

export type ProductReportFilters = {
  sourceSystem: string;
  caseID?: string;
  customerID?: string;
  status?: ProductReportStatus;
  from?: Date;
  to?: Date;
  limit?: number;
  cursor?: string;
};

export type ProductReport = {
  caseID: string;
  customerID: string | null;
  title: string;
  description: string;
  status: ProductReportStatus;
  priority: Priority;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  tags?: Array<{ id: string; name: string; color: string }>;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductReportPage = {
  reports: ProductReport[];
  nextCursor: string | null;
};

export type CaseTrend = {
  currentWeek: number;
  previousWeek: number;
  deltaPct: number | null;
};

export type CaseStatsSummary = {
  byStatus: Record<CaseStatus, number>;
  byPriority: Record<Priority, number>;
  atRisk: number;
  breached: number;
  newCaseTrend: CaseTrend;
  resolvedTrend: CaseTrend;
};

export type CaseDetail = CaseListItem & {
  customer: {
    id: string;
    externalId: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  messages: Array<{
    id: string;
    channel: string;
    direction: string;
    body: string;
    approvalStatus: string;
    deliveryStatus: string;
    deliveryAttempts: number;
    deliveryError: string | null;
    providerMessageId: string | null;
    createdAt: Date;
  }>;
  approvals: Array<{
    id: string;
    channel: string;
    status: string;
    draftBody: string;
    requestedReviewerId: string | null;
    requestedReviewerName: string | null;
    approverName: string | null;
    decidedAt: Date | null;
    createdAt: Date;
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    actorName: string | null;
    metadata: unknown;
    createdAt: Date;
  }>;
};

export type CreateCaseRecord = {
  title: string;
  description: string;
  priority: FeedbackCase["priority"];
  departmentId: string;
  customerId: string;
  sourceSystem: string;
  externalId?: string;
  assigneeId?: string;
  dueAt?: Date;
  slaDeadlineAt?: Date;
};

export type CaseRepository = {
  listCases(filters?: CaseListFilters): Promise<CaseListItem[]>;
  listCasesPage(query?: CaseListQuery, user?: AppUser): Promise<CaseListPage>;
  listProductReports(filters: ProductReportFilters): Promise<ProductReportPage>;
  getCaseStats(filters?: CaseListFilters, user?: AppUser, now?: Date): Promise<CaseStatsSummary>;
  createCase(input: CreateCaseRecord): Promise<FeedbackCase>;
  getCaseById(id: string): Promise<FeedbackCase | null>;
  getCaseBySourceExternalId(sourceSystem: string, externalId: string): Promise<FeedbackCase | null>;
  getCaseDetail(id: string): Promise<CaseDetail | null>;
  updateStatus(id: string, status: FeedbackCase["status"]): Promise<FeedbackCase>;
  assignCase(id: string, assigneeId: string | null, departmentId?: string): Promise<FeedbackCase>;
};

type PrismaCaseWithRelations = Case & {
  customer: { name: string | null };
  department: { name: string };
  assignee: { name: string } | null;
  tagAssignments: Array<{ tag: { id: string; name: string; color: string } }>;
};

type PrismaCaseDetail = Case & {
  customer: {
    id: string;
    externalId: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  department: { name: string };
  assignee: { name: string } | null;
  messages: Message[];
  approvals: Array<Approval & { approver: { name: string } | null; requestedReviewer: { name: string } | null }>;
  auditLogs: Array<AuditLog & { actor: { name: string } | null }>;
  tagAssignments: Array<{ tag: { id: string; name: string; color: string } }>;
};

function toFeedbackCase(record: Case): FeedbackCase {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    status: mapCaseStatusFromPrisma(record.status),
    priority: mapPriorityFromPrisma(record.priority),
    departmentId: record.departmentId,
    productSourceKey: record.sourceSystem,
    assigneeId: record.assigneeId ?? undefined,
    customerId: record.customerId,
    sourceSystem: record.sourceSystem,
    externalId: record.externalId ?? undefined,
    dueAt: record.dueAt ?? undefined,
    slaDeadlineAt: record.slaDeadlineAt ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function toCaseListItem(record: PrismaCaseWithRelations): CaseListItem {
  return {
    ...toFeedbackCase(record),
    customerName: record.customer.name,
    departmentName: record.department.name,
    productName: record.sourceSystem,
    assigneeName: record.assignee?.name ?? null,
    tags: record.tagAssignments.map((assignment) => assignment.tag)
  };
}

function readableEnum(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toCaseDetail(record: PrismaCaseDetail): CaseDetail {
  return {
    ...toCaseListItem(record),
    customer: record.customer,
    messages: record.messages.map((message) => ({
      id: message.id,
      channel: readableEnum(message.channel),
      direction: message.direction,
      body: message.body,
      approvalStatus: readableEnum(message.approvalStatus),
      deliveryStatus: readableEnum(message.deliveryStatus),
      deliveryAttempts: message.deliveryAttempts,
      deliveryError: message.deliveryError,
      providerMessageId: message.providerMessageId,
      createdAt: message.createdAt
    })),
    approvals: record.approvals.map((approval) => ({
      id: approval.id,
      channel: readableEnum(approval.channel),
      status: readableEnum(approval.status),
      draftBody: approval.draftBody,
      requestedReviewerId: approval.requestedReviewerId,
      requestedReviewerName: approval.requestedReviewer?.name ?? null,
      approverName: approval.approver?.name ?? null,
      decidedAt: approval.decidedAt,
      createdAt: approval.createdAt
    })),
    auditLogs: record.auditLogs.map((auditLog) => ({
      id: auditLog.id,
      action: auditLog.action,
      actorName: auditLog.actor?.name ?? null,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt
    }))
  };
}

function toProductReport(record: {
  id: string;
  externalId: string | null;
  title: string;
  description: string;
  status: PrismaCaseStatus;
  priority: PrismaPriority;
  createdAt: Date;
  updatedAt: Date;
  customer: {
    externalId: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  tagAssignments?: Array<{ tag: { id: string; name: string; color: string } }>;
}): ProductReport {
  return {
    caseID: record.externalId ?? record.id,
    customerID: record.customer.externalId,
    title: record.title,
    description: record.description,
    status: record.status,
    priority: mapPriorityFromPrisma(record.priority),
    customerName: record.customer.name,
    customerEmail: record.customer.email,
    customerPhone: record.customer.phone,
    tags: (record.tagAssignments ?? []).map((assignment) => assignment.tag),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function normalizePagination(query: CaseListQuery = {}) {
  const page = Number.isInteger(query.page) && query.page && query.page > 0 ? query.page : 1;
  const requestedPageSize = Number.isInteger(query.pageSize) && query.pageSize && query.pageSize > 0 ? query.pageSize : 10;
  const pageSize = Math.min(requestedPageSize, 100);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize
  };
}

function buildVisibilityWhere(user?: AppUser): Prisma.CaseWhereInput | undefined {
  if (!user) {
    return undefined;
  }

  if (!canEnterApplication(user)) {
    return { id: "__no_visible_cases__" };
  }

  const conditions: Prisma.CaseWhereInput[] = [];

  if (hasRole(user, "Customer Service")) {
    conditions.push({ assigneeId: user.id });
  }

  if (user.productSourceKeys.length > 0) {
    conditions.push({ sourceSystem: { in: user.productSourceKeys } });
  }

  if (conditions.length === 0) {
    return { id: "__no_visible_cases__" };
  }

  return { OR: conditions };
}

function buildCaseWhere(filters: CaseListFilters = {}, now = new Date(), user?: AppUser): Prisma.CaseWhereInput {
  const where: Prisma.CaseWhereInput = {};
  const activeStatuses: PrismaCaseStatus[] = ["NEW", "ASSIGNED", "IN_PROGRESS", "REOPENED"];
  const riskWindow = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  function and(condition: Prisma.CaseWhereInput) {
    where.AND = [...(Array.isArray(where.AND) ? where.AND : []), condition];
  }

  if (filters.status) {
    where.status = mapCaseStatusToPrisma(filters.status);
  }

  if (filters.priority) {
    where.priority = mapPriorityToPrisma(filters.priority);
  }

  if (filters.departmentId) {
    where.departmentId = filters.departmentId;
  }

  if (filters.assigneeId) {
    where.assigneeId = filters.assigneeId === "unassigned" ? null : filters.assigneeId;
  }

  if (filters.tagId) {
    where.tagAssignments = {
      some: {
        tagId: filters.tagId
      }
    };
  }

  if (filters.sourceSystem) {
    where.sourceSystem = {
      contains: filters.sourceSystem,
      mode: "insensitive"
    };
  }

  if (filters.sourceSystems && filters.sourceSystems.length > 0) {
    where.sourceSystem = {
      in: filters.sourceSystems
    };
  }

  if (filters.search) {
    and({
      OR: [
        { id: { contains: filters.search, mode: "insensitive" } },
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
        { externalId: { contains: filters.search, mode: "insensitive" } },
        { sourceSystem: { contains: filters.search, mode: "insensitive" } },
        { customer: { name: { contains: filters.search, mode: "insensitive" } } }
      ]
    });
  }

  if (filters.slaState === "breached") {
    and({ status: { in: activeStatuses } });
    and({ slaDeadlineAt: { lt: now } });
  }

  if (filters.slaState === "at-risk") {
    and({ status: { in: activeStatuses } });
    and({ slaDeadlineAt: { gt: now, lte: riskWindow } });
  }

  if (filters.slaState === "on-track") {
    and({
      OR: [
        { status: { in: ["RESOLVED", "CLOSED"] } },
        { slaDeadlineAt: null },
        { slaDeadlineAt: { gt: riskWindow } }
      ]
    });
  }

  const visibilityWhere = buildVisibilityWhere(user);

  if (visibilityWhere) {
    and(visibilityWhere);
  }

  return where;
}

export function createPrismaCaseRepository(client: PrismaClient = prisma): CaseRepository {
  return {
    async listCases(filters) {
      const records = await client.case.findMany({
        where: buildCaseWhere(filters),
        include: {
          assignee: { select: { name: true } },
          customer: { select: { name: true } },
          department: { select: { name: true } },
          tagAssignments: { include: { tag: { select: { id: true, name: true, color: true } } } }
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
      });

      return records.map(toCaseListItem);
    },

    async listCasesPage(query, user) {
      const { page, pageSize, skip } = normalizePagination(query);
      const where = buildCaseWhere(query, new Date(), user);
      const include = {
        assignee: { select: { name: true } },
        customer: { select: { name: true } },
        department: { select: { name: true } },
        tagAssignments: { include: { tag: { select: { id: true, name: true, color: true } } } }
      };
      const orderBy: Prisma.CaseOrderByWithRelationInput[] = [{ updatedAt: "desc" }, { createdAt: "desc" }];
      const [total, records] = await Promise.all([
        client.case.count({ where }),
        client.case.findMany({
          where,
          include,
          orderBy,
          skip,
          take: pageSize
        })
      ]);

      return {
        items: records.map(toCaseListItem),
        total,
        page,
        pageSize,
        pageCount: Math.max(1, Math.ceil(total / pageSize))
      };
    },

    async listProductReports(filters) {
      const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
      const where: Prisma.CaseWhereInput = {
        sourceSystem: filters.sourceSystem
      };

      if (filters.caseID) {
        where.externalId = filters.caseID;
      }

      if (filters.customerID) {
        where.customer = { externalId: filters.customerID };
      }

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.from || filters.to) {
        where.createdAt = {
          ...(filters.from ? { gte: filters.from } : {}),
          ...(filters.to ? { lte: filters.to } : {})
        };
      }

      const records = await client.case.findMany({
        where,
        select: {
          id: true,
          externalId: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
          customer: {
            select: {
              externalId: true,
              name: true,
              email: true,
              phone: true
            }
          },
          tagAssignments: { include: { tag: { select: { id: true, name: true, color: true } } } }
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
        take: limit + 1
      });

      const pageRecords = records.slice(0, limit);

      return {
        reports: pageRecords.map(toProductReport),
        nextCursor: records.length > limit ? pageRecords.at(-1)?.id ?? null : null
      };
    },

    async getCaseStats(filters, user, now = new Date()) {
      const activeStatuses: PrismaCaseStatus[] = ["NEW", "ASSIGNED", "IN_PROGRESS", "REOPENED"];
      const riskWindow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const scopeWhere = buildCaseWhere({ ...filters, slaState: undefined }, now, user);

      function withExtra(extra: Prisma.CaseWhereInput): Prisma.CaseWhereInput {
        return { ...scopeWhere, AND: [...(Array.isArray(scopeWhere.AND) ? scopeWhere.AND : []), extra] };
      }

      const [statusGroups, priorityGroups, atRisk, breached, newCurrent, newPrevious, resolvedCurrent, resolvedPrevious] =
        await Promise.all([
          client.case.groupBy({ by: ["status"], where: scopeWhere, _count: { _all: true } }),
          client.case.groupBy({ by: ["priority"], where: scopeWhere, _count: { _all: true } }),
          client.case.count({
            where: withExtra({ status: { in: activeStatuses }, slaDeadlineAt: { gt: now, lte: riskWindow } })
          }),
          client.case.count({
            where: withExtra({ status: { in: activeStatuses }, slaDeadlineAt: { lt: now } })
          }),
          client.case.count({ where: withExtra({ createdAt: { gte: sevenDaysAgo } }) }),
          client.case.count({ where: withExtra({ createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } }) }),
          client.case.count({
            where: withExtra({ status: { in: ["RESOLVED", "CLOSED"] }, updatedAt: { gte: sevenDaysAgo } })
          }),
          client.case.count({
            where: withExtra({
              status: { in: ["RESOLVED", "CLOSED"] },
              updatedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo }
            })
          })
        ]);

      const byStatus = Object.fromEntries(caseStatuses.map((status) => [status, 0])) as Record<CaseStatus, number>;
      for (const group of statusGroups) {
        byStatus[mapCaseStatusFromPrisma(group.status)] = group._count._all;
      }

      const byPriority = Object.fromEntries(priorities.map((priority) => [priority, 0])) as Record<Priority, number>;
      for (const group of priorityGroups) {
        byPriority[mapPriorityFromPrisma(group.priority)] = group._count._all;
      }

      function trend(currentWeek: number, previousWeek: number): CaseTrend {
        const deltaPct = previousWeek === 0 ? null : Math.round(((currentWeek - previousWeek) / previousWeek) * 100);
        return { currentWeek, previousWeek, deltaPct };
      }

      return {
        byStatus,
        byPriority,
        atRisk,
        breached,
        newCaseTrend: trend(newCurrent, newPrevious),
        resolvedTrend: trend(resolvedCurrent, resolvedPrevious)
      };
    },

    async createCase(input) {
      const record = await client.case.create({
        data: {
          title: input.title,
          description: input.description,
          priority: mapPriorityToPrisma(input.priority),
          departmentId: input.departmentId,
          customerId: input.customerId,
          sourceSystem: input.sourceSystem,
          externalId: input.externalId,
          assigneeId: input.assigneeId,
          dueAt: input.dueAt,
          slaDeadlineAt: input.slaDeadlineAt
        }
      });

      return toFeedbackCase(record);
    },

    async getCaseById(id) {
      const record = await client.case.findUnique({ where: { id } });
      return record ? toFeedbackCase(record) : null;
    },

    async getCaseBySourceExternalId(sourceSystem, externalId) {
      const record = await client.case.findUnique({
        where: {
          sourceSystem_externalId: {
            sourceSystem,
            externalId
          }
        }
      });
      return record ? toFeedbackCase(record) : null;
    },

    async getCaseDetail(id) {
      const record = await client.case.findUnique({
        where: { id },
        include: {
          assignee: { select: { name: true } },
          customer: {
            select: {
              id: true,
              externalId: true,
              name: true,
              email: true,
              phone: true
            }
          },
          department: { select: { name: true } },
          tagAssignments: { include: { tag: { select: { id: true, name: true, color: true } } } },
          messages: { orderBy: { createdAt: "desc" } },
          approvals: {
            include: {
              approver: { select: { name: true } },
              requestedReviewer: { select: { name: true } }
            },
            orderBy: { createdAt: "desc" }
          },
          auditLogs: {
            include: {
              actor: { select: { name: true } }
            },
            orderBy: { createdAt: "desc" }
          }
        }
      });

      return record ? toCaseDetail(record) : null;
    },

    async updateStatus(id, status) {
      const record = await client.case.update({
        where: { id },
        data: { status: mapCaseStatusToPrisma(status) }
      });

      return toFeedbackCase(record);
    },

    async assignCase(id, assigneeId, departmentId) {
      const record = await client.case.update({
        where: { id },
        data: {
          assigneeId,
          departmentId
        }
      });

      return toFeedbackCase(record);
    }
  };
}
