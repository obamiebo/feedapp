import { afterEach, describe, expect, it, vi } from "vitest";
import type { Approval } from "@prisma/client";
import type { Message } from "@prisma/client";
import type { AppUser, FeedbackCase, SlaPolicy } from "@/domain/types";
import type { CreateAuditLogRecord } from "@/repositories/audit-logs";
import type {
  CaseDetail,
  CaseListFilters,
  CaseListItem,
  CaseListQuery,
  CaseRepository,
  CreateCaseRecord
} from "@/repositories/cases";
import { createCaseService } from "@/services/cases";

function makeCase(overrides: Partial<FeedbackCase> = {}): FeedbackCase {
  const now = new Date("2026-07-07T12:00:00.000Z");

  return {
    id: "case-1",
    title: "Checkout failure",
    description: "Customer cannot complete checkout.",
    status: "New",
    priority: "High",
    departmentId: "dept-payments",
    customerId: "customer-1",
    sourceSystem: "manual",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "user-1",
    email: "user@example.com",
    name: "User",
    roles: ["Product User"],
    departmentIds: ["dept-payments"],
    directProductSourceKeys: ["manual"],
    productSourceKeys: ["manual"],
    productGroupIds: [],
    provisioned: true,
    ...overrides
  };
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "message-1",
    caseId: "case-1",
    channel: "EMAIL",
    direction: "outbound",
    body: "Message body",
    approvalStatus: "APPROVED",
    providerMessageId: null,
    deliveryStatus: "ACCEPTED",
    deliveryAttempts: 0,
    deliveryError: null,
    lastDeliveryAttemptAt: null,
    createdAt: new Date("2026-07-07T12:05:00.000Z"),
    ...overrides
  };
}

function makeDependencies(initialCase = makeCase(), options: { callbacksEnabled?: boolean; reviewers?: AppUser[] } = {}) {
  let currentCase = initialCase;
  const auditEvents: CreateAuditLogRecord[] = [];
  const createdRecords: CreateCaseRecord[] = [];
  const inboundMessages: Array<{ caseId: string; channel: string; body: string; externalMessageId?: string }> = [];
  const internalNotes: Array<{ caseId: string; body: string }> = [];
  const approvalRequests: Array<{ caseId: string; channel: string; draftBody: string; requestedReviewerId?: string | null }> = [];
  const approvedMessages: Array<{ caseId: string; channel: string; body: string }> = [];
  const createdStages: Array<{ caseId: string; status: string; priority: string; startedAt?: Date }> = [];
  const stageTransitions: Array<{ caseId: string; status: string; priority: string; startedAt?: Date }> = [];
  const stageCustomerUpdates: Array<{ caseId: string; incrementFollowUp?: boolean }> = [];
  const sentDeliveries: Array<{ caseId: string; channel: string; recipient: string; body: string }> = [];
  const markedDeliveries: Array<{
    messageId: string;
    providerMessageId?: string;
    deliveryStatus: "ACCEPTED" | "SENT" | "FAILED";
    deliveryError?: string | null;
  }> = [];
  const callbackAttempts: Array<{ sourceId: string; caseId: string; eventType: string; payload: unknown }> = [];
  const markedCallbacks: Array<{ attemptId: string; status: "SENT" | "FAILED"; responseStatus?: number | null; lastError?: string | null }> = [];
  const failedOutboundMessages = [
    {
      ...makeMessage({
        id: "message-failed-1",
        caseId: "case-1",
        channel: "EMAIL",
        body: "Previous message failed.",
        deliveryStatus: "FAILED",
        deliveryAttempts: 1,
        deliveryError: "Provider unavailable"
      }),
      case: {
        id: "case-1",
        title: "Checkout failure",
        sourceSystem: "manual",
        customer: {
          name: "Test Customer",
          email: "customer@example.com",
          phone: null
        }
      }
    }
  ];
  const listFilters: CaseListFilters[] = [];
  const paginatedQueries: Array<{ query: CaseListQuery | undefined; userId: string | undefined }> = [];
  let activeStage = {
    id: "stage-1",
    caseId: currentCase.id,
    status: currentCase.status,
    priority: currentCase.priority,
    startedAt: currentCase.createdAt,
    endedAt: null,
    lastCustomerUpdateAt: null as Date | null,
    lastPromptReviewedAt: null as Date | null,
    followUpCount: 0
  };
  let currentApproval: Approval = {
    id: "approval-1",
    caseId: currentCase.id,
    approverId: null,
    requestedReviewerId: null,
    channel: "EMAIL" as const,
    status: "PENDING" as const,
    draftBody: "We are looking into this and will update you shortly.",
    decidedAt: null,
    createdAt: new Date("2026-07-07T12:00:00.000Z")
  };

  const cases: CaseRepository = {
    async listCases(filters): Promise<CaseListItem[]> {
      if (filters) {
        listFilters.push(filters);
      }
      return [];
    },
    async listCasesPage(query, user) {
      paginatedQueries.push({ query, userId: user?.id });
      return {
        items: [],
        total: 0,
        page: query?.page ?? 1,
        pageSize: query?.pageSize ?? 10,
        pageCount: 1
      };
    },
    async listProductReports() {
      return { reports: [], nextCursor: null };
    },
    async getCaseStats() {
      return {
        byStatus: { New: 0, Assigned: 0, "In Progress": 0, Resolved: 0, Closed: 0, Reopened: 0 },
        byPriority: { Low: 0, Medium: 0, High: 0, Critical: 0 },
        atRisk: 0,
        breached: 0,
        newCaseTrend: { currentWeek: 0, previousWeek: 0, deltaPct: null },
        resolvedTrend: { currentWeek: 0, previousWeek: 0, deltaPct: null }
      };
    },
    async createCase(input) {
      createdRecords.push(input);
      currentCase = makeCase({
        ...input,
        id: "case-created",
        status: "New"
      });
      return currentCase;
    },
    async getCaseById(id) {
      return id === currentCase.id ? currentCase : null;
    },
    async getCaseBySourceExternalId(sourceSystem, externalId) {
      return currentCase.sourceSystem === sourceSystem && currentCase.externalId === externalId ? currentCase : null;
    },
    async getCaseDetail(id): Promise<CaseDetail | null> {
      if (id !== currentCase.id) {
        return null;
      }

      return {
        ...currentCase,
        customerName: "Test Customer",
        departmentName: "Payments",
        productName: currentCase.sourceSystem,
        assigneeName: currentCase.assigneeId ? "Assigned User" : null,
        customer: {
          id: currentCase.customerId,
          externalId: null,
          name: "Test Customer",
          email: "customer@example.com",
          phone: null
        },
        messages: [],
        approvals: [],
        auditLogs: []
      };
    },
    async updateStatus(id, status) {
      currentCase = makeCase({
        ...currentCase,
        id,
        status
      });
      return currentCase;
    },
    async assignCase(id, assigneeId, departmentId) {
      currentCase = makeCase({
        ...currentCase,
        id,
        assigneeId: assigneeId ?? undefined,
        departmentId: departmentId ?? currentCase.departmentId
      });
      return currentCase;
    }
  };

  const policy: SlaPolicy = {
    departmentId: "dept-payments",
    priority: "High",
    responseTargetHours: 2,
    resolutionTargetHours: 8,
    escalationTargetHours: 4
  };

  return {
    auditEvents,
    approvalRequests,
    approvedMessages,
    createdRecords,
    createdStages,
    inboundMessages,
    internalNotes,
    listFilters,
    markedDeliveries,
    callbackAttempts,
    markedCallbacks,
    paginatedQueries,
    stageCustomerUpdates,
    stageTransitions,
    sentDeliveries,
    service: createCaseService({
      cases,
      auditLogs: {
        async createAuditLog(input) {
          auditEvents.push(input);
        }
      },
      customers: {
        async findOrCreateCustomer() {
          return {
            id: "customer-created",
            externalId: null,
            name: "New Customer",
            email: "new.customer@example.com",
            phone: null
          };
        }
      },
      messages: {
        async createInboundCustomerMessage(input) {
          inboundMessages.push(input);
          return makeMessage({
            id: "message-inbound-1",
            caseId: input.caseId,
            channel: input.channel === "SMS" ? "SMS" : "EMAIL",
            direction: "inbound",
            body: input.body,
            providerMessageId: input.externalMessageId ?? null,
            approvalStatus: "APPROVED",
            deliveryStatus: "NOT_REQUIRED",
            createdAt: new Date("2026-07-07T12:00:00.000Z")
          });
        },
        async createInternalNote(input) {
          internalNotes.push(input);
          return makeMessage({
            id: "message-1",
            caseId: input.caseId,
            channel: "INTERNAL_NOTE",
            direction: "internal",
            body: input.body,
            approvalStatus: "APPROVED",
            deliveryStatus: "NOT_REQUIRED",
            createdAt: new Date("2026-07-07T12:00:00.000Z")
          });
        },
        async createApprovalRequest(input) {
          approvalRequests.push(input);
          currentApproval = {
            id: "approval-1",
            caseId: input.caseId,
            approverId: null,
            requestedReviewerId: input.requestedReviewerId ?? null,
            channel: input.channel === "SMS" ? "SMS" : "EMAIL",
            status: "PENDING",
            draftBody: input.draftBody,
            decidedAt: null,
            createdAt: new Date("2026-07-07T12:00:00.000Z")
          };
          return currentApproval;
        },
        async getApprovalById(id) {
          return id === currentApproval.id ? currentApproval : null;
        },
        async approveRequest(input) {
          currentApproval = {
            ...currentApproval,
            approverId: input.approverId,
            status: "APPROVED",
            draftBody: input.reviewedBody,
            decidedAt: new Date("2026-07-07T12:05:00.000Z")
          };
          return currentApproval;
        },
        async rejectRequest(input) {
          currentApproval = {
            ...currentApproval,
            approverId: input.approverId,
            status: "REJECTED",
            decidedAt: new Date("2026-07-07T12:05:00.000Z")
          };
          return currentApproval;
        },
        async createApprovedOutboundMessage(input) {
          approvedMessages.push(input);
          return makeMessage({
            id: "message-approved-1",
            caseId: input.caseId,
            channel: input.channel === "SMS" ? "SMS" : "EMAIL",
            direction: "outbound",
            body: input.body,
            approvalStatus: "APPROVED",
            deliveryStatus: input.deliveryStatus ?? "ACCEPTED",
            deliveryAttempts: input.deliveryStatus === "FAILED" ? 1 : 0,
            deliveryError: input.deliveryError ?? null,
            createdAt: new Date("2026-07-07T12:05:00.000Z")
          });
        },
        async markOutboundDelivery(input) {
          markedDeliveries.push(input);
          return makeMessage({
            id: input.messageId,
            providerMessageId: input.providerMessageId ?? null,
            deliveryStatus: input.deliveryStatus,
            deliveryAttempts: 1,
            deliveryError: input.deliveryError ?? null,
            lastDeliveryAttemptAt: new Date("2026-07-07T12:05:00.000Z")
          });
        },
        async listRecentOutboundMessages() {
          return [];
        },
        async listFailedOutboundMessages() {
          return failedOutboundMessages;
        },
        async listPendingCustomerReplyApprovalsForUser() {
          return [];
        }
      },
      caseStages: {
        async createInitialStage(input) {
          createdStages.push(input);
          activeStage = {
            ...activeStage,
            id: "stage-created",
            caseId: input.caseId,
            status: input.status,
            priority: input.priority,
            startedAt: input.startedAt ?? new Date("2026-07-07T12:00:00.000Z"),
            endedAt: null,
            lastCustomerUpdateAt: null,
            lastPromptReviewedAt: null,
            followUpCount: 0
          };
          return activeStage;
        },
        async transitionToStage(input) {
          stageTransitions.push(input);
          activeStage = {
            ...activeStage,
            id: "stage-transitioned",
            caseId: input.caseId,
            status: input.status,
            priority: input.priority,
            startedAt: input.startedAt ?? new Date("2026-07-07T12:00:00.000Z"),
            endedAt: null,
            lastCustomerUpdateAt: null,
            lastPromptReviewedAt: null,
            followUpCount: 0
          };
          return activeStage;
        },
        async findActiveStage(caseId) {
          return caseId === activeStage.caseId ? activeStage : null;
        },
        async markCustomerUpdate(caseId, input) {
          stageCustomerUpdates.push({ caseId, incrementFollowUp: input?.incrementFollowUp });
          activeStage = {
            ...activeStage,
            lastCustomerUpdateAt: input?.at ?? new Date("2026-07-07T12:05:00.000Z"),
            followUpCount: input?.incrementFollowUp ? activeStage.followUpCount + 1 : activeStage.followUpCount
          };
        },
        async markPromptReviewed(caseId, at) {
          activeStage = {
            ...activeStage,
            caseId,
            lastPromptReviewedAt: at ?? new Date("2026-07-07T12:05:00.000Z")
          };
        },
        async listStaleStages() {
          return [];
        }
      },
      messagingCadence: {
        async listPolicies() {
          return [];
        },
        async findPolicy() {
          return {
            id: "cadence-1",
            status: activeStage.status,
            priority: activeStage.priority,
            staleAfterHours: 72,
            enabled: true
          };
        },
        async upsertPolicy(input) {
          return {
            id: "cadence-1",
            ...input
          };
        }
      },
      slaPolicies: {
        async findPolicy() {
          return policy;
        }
      },
      messagingProvider: {
        async send(input) {
          sentDeliveries.push(input);
          return {
            providerMessageId: `provider-${input.caseId}`,
            status: "accepted"
          };
        }
      },
      users: {
        async listAssignableUsers() {
          return [];
        },
        async listAssignableUsersByProductSourceKey() {
          return [];
        },
        async listAppUsersByProductSourceKey() {
          return options.reviewers ?? [
            makeUser({
              id: "user-product-manager",
              name: "Product Manager",
              roles: ["Product Manager"],
              directProductSourceKeys: [currentCase.sourceSystem],
              productSourceKeys: [currentCase.sourceSystem]
            })
          ];
        },
        async getAppUser(id) {
          if (id === "user-assignee") {
            return makeUser({
              id,
              directProductSourceKeys: [currentCase.sourceSystem],
              productSourceKeys: [currentCase.sourceSystem]
            });
          }

          if (id === "user-group-assignee") {
            return makeUser({
              id,
              directProductSourceKeys: [],
              productSourceKeys: [currentCase.sourceSystem]
            });
          }

          if (id === "user-outside-product") {
            return makeUser({
              id,
              directProductSourceKeys: ["other-product"],
              productSourceKeys: ["other-product"]
            });
          }

          return null;
        },
        async getAppUserByEmail() {
          return null;
        },
        async listAppUsers() {
          return [
            makeUser({
              id: "user-admin",
              name: "Admin User",
              roles: ["Admin"]
            })
          ];
        }
      },
      integrations: {
        async findSourceByKey(key) {
          if (key !== currentCase.sourceSystem) {
            return null;
          }

          return {
            id: "source-1",
            key: currentCase.sourceSystem,
            name: "Manual",
            enabled: true,
            secretHash: null,
            config: options.callbacksEnabled
              ? {
                  callbackUrl: "https://product.example.test/status",
                  callbackSecret: "callback-secret"
                }
              : {}
          };
        },
        async findSourcesByKeys() {
          return [];
        },
        async listProductSources() {
          return [];
        },
        async listProductGroups() {
          return [];
        },
        async updateSourceCallbackConfig() {},
        async findEventByIdempotencyKey() {
          return null;
        },
        async createEvent() {
          return {
            id: "event-1",
            caseId: currentCase.id,
            externalId: currentCase.externalId ?? "external-1",
            idempotencyKey: "manual:external-1",
            status: "accepted"
          };
        },
        async createCallbackAttempt(input) {
          callbackAttempts.push(input);
          return {
            id: "callback-attempt-1",
            sourceId: input.sourceId,
            sourceKey: currentCase.sourceSystem,
            sourceName: "Manual",
            caseId: input.caseId,
            caseTitle: currentCase.title,
            eventType: input.eventType,
            payload: input.payload,
            status: "QUEUED",
            responseStatus: null,
            deliveryAttempts: 0,
            lastError: null,
            lastAttemptAt: null,
            createdAt: new Date("2026-07-07T12:00:00.000Z")
          };
        },
        async markCallbackAttempt(input) {
          markedCallbacks.push(input);
          return {
            id: input.attemptId,
            sourceId: "source-1",
            sourceKey: currentCase.sourceSystem,
            sourceName: "Manual",
            caseId: currentCase.id,
            caseTitle: currentCase.title,
            eventType: "case.status_changed",
            payload: {},
            status: input.status,
            responseStatus: input.responseStatus ?? null,
            deliveryAttempts: 1,
            lastError: input.lastError ?? null,
            lastAttemptAt: new Date("2026-07-07T12:00:00.000Z"),
            createdAt: new Date("2026-07-07T12:00:00.000Z")
          };
        },
        async listFailedCallbackAttempts() {
          return [
            {
              id: "callback-failed-1",
              sourceId: "source-1",
              sourceKey: currentCase.sourceSystem,
              sourceName: "Manual",
              caseId: currentCase.id,
              caseTitle: currentCase.title,
              eventType: "case.status_changed",
              payload: {
                eventType: "case.status_changed",
                case: { id: currentCase.id }
              },
              status: "FAILED",
              responseStatus: 500,
              deliveryAttempts: 1,
              lastError: "Callback returned 500",
              lastAttemptAt: new Date("2026-07-07T12:00:00.000Z"),
              createdAt: new Date("2026-07-07T12:00:00.000Z")
            }
          ];
        },
        async markSourceSuccess() {},
        async markSourceError() {}
      }
    })
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("case service", () => {
  it("passes case list filters to the repository", async () => {
    const { listFilters, service } = makeDependencies();

    await service.listCases({
      status: "Assigned",
      priority: "High",
      departmentId: "dept-finance",
      assigneeId: "user-cs-1",
      sourceSystem: "manual",
      slaState: "at-risk",
      search: "checkout"
    });

    expect(listFilters).toEqual([
      {
        status: "Assigned",
        priority: "High",
        departmentId: "dept-finance",
        assigneeId: "user-cs-1",
        sourceSystem: "manual",
        slaState: "at-risk",
        search: "checkout"
      }
    ]);
  });

  it("passes paginated user-scoped case queries to the repository", async () => {
    const { paginatedQueries, service } = makeDependencies();
    const user = makeUser({ id: "user-cs-1", roles: ["Customer Service"] });

    await service.listCasesPageForUser(user, {
      search: "checkout",
      slaState: "on-track",
      page: 2,
      pageSize: 10
    });

    expect(paginatedQueries).toEqual([
      {
        query: {
          search: "checkout",
          slaState: "on-track",
          page: 2,
          pageSize: 10
        },
        userId: "user-cs-1"
      }
    ]);
  });

  it("creates cases with SLA deadlines and audit events", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T10:00:00.000Z"));
    const { auditEvents, createdRecords, createdStages, inboundMessages, service } = makeDependencies();

    const created = await service.createCase(
      {
        title: "Checkout failure",
        description: "Customer cannot complete checkout.",
        priority: "High",
        departmentId: "dept-payments",
        customerId: "customer-1",
        sourceSystem: "manual"
      },
      "user-admin"
    );

    expect(created.id).toBe("case-created");
    expect(createdRecords[0].slaDeadlineAt?.toISOString()).toBe("2026-07-07T18:00:00.000Z");
    expect(createdRecords[0].dueAt?.toISOString()).toBe("2026-07-07T18:00:00.000Z");
    expect(createdStages).toEqual([
      expect.objectContaining({
        caseId: "case-created",
        status: "New",
        priority: "High"
      })
    ]);
    expect(inboundMessages).toEqual([
      {
        caseId: "case-created",
        channel: "Email",
        body: "Customer cannot complete checkout."
      }
    ]);
    expect(auditEvents).toEqual([
      expect.objectContaining({
        actorId: "user-admin",
        caseId: "case-created",
        action: "case.created"
      }),
      expect.objectContaining({
        actorId: "user-admin",
        caseId: "case-created",
        action: "case.customer_acknowledgement_sent",
        metadata: expect.objectContaining({
          channel: "Email",
          deliveryStatus: "ACCEPTED"
        })
      })
    ]);
  });

  it("creates manual cases with a matched or created customer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T10:00:00.000Z"));
    const { auditEvents, createdRecords, service } = makeDependencies();

    const created = await service.createManualCase(
      {
        title: "Manual report",
        description: "Customer called the support desk.",
        priority: "High",
        departmentId: "dept-payments",
        customer: {
          name: "New Customer",
          email: "new.customer@example.com"
        }
      },
      "user-admin"
    );

    expect(created.id).toBe("case-created");
    expect(createdRecords[0]).toEqual(
      expect.objectContaining({
        customerId: "customer-created",
        sourceSystem: "manual"
      })
    );
    expect(auditEvents).toEqual([
      expect.objectContaining({
        action: "case.created",
        caseId: "case-created"
      }),
      expect.objectContaining({
        action: "case.customer_acknowledgement_sent",
        caseId: "case-created",
        metadata: expect.objectContaining({
          channel: "Email",
          deliveryStatus: "ACCEPTED"
        })
      })
    ]);
  });

  it("denies manual case creation for users without the customer service role", async () => {
    const { service } = makeDependencies();

    await expect(
      service.createManualCaseForUser(
        {
          title: "Manual report",
          description: "Customer called the support desk.",
          priority: "High",
          departmentId: "dept-payments",
          customer: {
            name: "New Customer"
          }
        },
        makeUser()
      )
    ).rejects.toThrow("Current user cannot create cases for this product");
  });

  it("allows customer service users to create manual cases", async () => {
    const { createdRecords, inboundMessages, service } = makeDependencies();

    await service.createManualCaseForUser(
      {
        title: "Manual report",
        description: "Customer called the support desk.",
        priority: "High",
        departmentId: "dept-payments",
        customer: {
          name: "New Customer"
        }
      },
      makeUser({ roles: ["Customer Service"] })
    );

    expect(createdRecords[0]).toEqual(expect.objectContaining({ customerId: "customer-created" }));
    expect(inboundMessages[0]).toEqual({
      caseId: "case-created",
      channel: "Email",
      body: "Customer called the support desk."
    });
  });

  it("denies customer service users creating cases for products outside their scope", async () => {
    const { createdRecords, service } = makeDependencies();

    await expect(
      service.createManualCaseForUser(
        {
          title: "Manual report",
          description: "Customer called the support desk.",
          priority: "High",
          departmentId: "dept-payments",
          sourceSystem: "other-product",
          customer: {
            name: "New Customer"
          }
        },
        makeUser({ roles: ["Customer Service"], productSourceKeys: ["manual"] })
      )
    ).rejects.toThrow("Current user cannot create cases for this product");

    expect(createdRecords).toEqual([]);
  });

  it("allows customer service users to create cases through product-group access", async () => {
    const { createdRecords, service } = makeDependencies();

    await service.createManualCaseForUser(
      {
        title: "Manual report",
        description: "Customer called the support desk.",
        priority: "High",
        departmentId: "dept-payments",
        sourceSystem: "group-product",
        customer: {
          name: "New Customer"
        }
      },
      makeUser({
        roles: ["Customer Service"],
        directProductSourceKeys: [],
        productSourceKeys: ["group-product"],
        productGroupIds: ["group-1"]
      })
    );

    expect(createdRecords[0]).toEqual(expect.objectContaining({ sourceSystem: "group-product" }));
  });

  it("enforces product scope for API-style case creation", async () => {
    const { createdRecords, service } = makeDependencies();
    const user = makeUser({ roles: ["Customer Service"], productSourceKeys: ["manual"] });

    await expect(
      service.createCaseForUser(
        {
          title: "Manual report",
          description: "Customer called the support desk.",
          priority: "High",
          departmentId: "dept-payments",
          customerId: "customer-1",
          sourceSystem: "other-product"
        },
        user
      )
    ).rejects.toThrow("Current user cannot create cases for this product");

    expect(createdRecords).toEqual([]);
  });

  it("blocks invalid status transitions before writing audit events", async () => {
    const { auditEvents, service, stageTransitions } = makeDependencies(makeCase({ status: "New" }));

    await expect(service.transitionCase("case-1", "Resolved", "user-admin")).rejects.toThrow(
      "Invalid case transition from New to Resolved"
    );
    expect(auditEvents).toEqual([]);
  });

  it("updates valid status transitions and writes the transition audit event", async () => {
    const { auditEvents, service, stageTransitions } = makeDependencies(makeCase({ status: "New" }));

    const updated = await service.transitionCase("case-1", "Assigned", "user-admin");

    expect(updated.status).toBe("Assigned");
    expect(stageTransitions).toEqual([
      expect.objectContaining({
        caseId: "case-1",
        status: "Assigned",
        priority: "High"
      })
    ]);
    expect(auditEvents).toEqual([
      expect.objectContaining({
        actorId: "user-admin",
        caseId: "case-1",
        action: "case.status_changed",
        metadata: expect.objectContaining({
          from: "New",
          to: "Assigned"
        })
      })
    ]);
  });

  it("denies unauthorized status transitions", async () => {
    const { service } = makeDependencies(makeCase({ status: "Assigned" }));

    await expect(service.transitionCaseForUser("case-1", "Closed", makeUser())).rejects.toThrow(
      "Current user cannot transition this case"
    );
  });

  it("loads case detail records from the repository", async () => {
    const { service } = makeDependencies(makeCase({ assigneeId: "user-1" }));

    const detail = await service.getCaseDetail("case-1");

    expect(detail).toEqual(
      expect.objectContaining({
        id: "case-1",
        customerName: "Test Customer",
        departmentName: "Payments",
        assigneeName: "Assigned User"
      })
    );
  });

  it("distinguishes inaccessible existing cases from missing cases", async () => {
    const { service } = makeDependencies(makeCase({ sourceSystem: "commerce-platform" }));

    await expect(
      service.getCaseDetailAccessForUser("case-1", makeUser({ roles: ["Admin"], productSourceKeys: [] }))
    ).resolves.toEqual({
      status: "forbidden",
      caseDetail: expect.objectContaining({ id: "case-1" })
    });
    await expect(service.getCaseDetailAccessForUser("missing-case", makeUser({ roles: ["Admin"] }))).resolves.toEqual({
      status: "not-found"
    });
  });

  it("updates assignment and writes the assignment audit event", async () => {
    const { auditEvents, service } = makeDependencies(makeCase({ assigneeId: "user-old" }));

    const updated = await service.assignCase("case-1", "user-new", "dept-products", "user-admin");

    expect(updated.assigneeId).toBe("user-new");
    expect(updated.departmentId).toBe("dept-products");
    expect(auditEvents).toEqual([
      expect.objectContaining({
        actorId: "user-admin",
        caseId: "case-1",
        action: "case.assigned",
        metadata: expect.objectContaining({
          fromAssigneeId: "user-old",
          toAssigneeId: "user-new",
          fromDepartmentId: "dept-payments",
          toDepartmentId: "dept-products"
        })
      })
    ]);
  });

  it("sends signed product callbacks when product cases are assigned", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetch);
    const { callbackAttempts, markedCallbacks, service } = makeDependencies(makeCase({ assigneeId: "user-old" }), {
      callbacksEnabled: true
    });

    await service.assignCase("case-1", "user-new", "dept-products", "user-admin");

    expect(callbackAttempts).toEqual([
      expect.objectContaining({
        sourceId: "source-1",
        caseId: "case-1",
        eventType: "case.assigned",
        payload: expect.objectContaining({
          eventType: "case.assigned",
          case: expect.objectContaining({
            id: "case-1",
            sourceSystem: "manual",
            assigneeId: "user-new"
          })
        })
      })
    ]);
    expect(fetch).toHaveBeenCalledWith(
      "https://product.example.test/status",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
          "x-feedback-source": "manual",
          "x-feedback-signature": expect.any(String)
        })
      })
    );
    expect(markedCallbacks).toEqual([
      expect.objectContaining({
        attemptId: "callback-attempt-1",
        status: "SENT",
        responseStatus: 200,
        lastError: null
      })
    ]);
  });

  it("allows product users to assign cases to users with effective product access", async () => {
    const { auditEvents, service } = makeDependencies(makeCase({ sourceSystem: "manual" }));
    const actor = makeUser({ id: "user-actor", productSourceKeys: ["manual"] });

    const updated = await service.assignCaseForUser("case-1", "user-group-assignee", "dept-payments", actor);

    expect(updated.assigneeId).toBe("user-group-assignee");
    expect(auditEvents).toEqual([
      expect.objectContaining({
        actorId: "user-actor",
        action: "case.assigned",
        metadata: expect.objectContaining({
          toAssigneeId: "user-group-assignee"
        })
      })
    ]);
  });

  it("keeps user-facing assignment centered on rep ownership instead of department handoff", async () => {
    const { auditEvents, service } = makeDependencies(makeCase({ departmentId: "dept-payments", sourceSystem: "manual" }));
    const actor = makeUser({ id: "user-actor", productSourceKeys: ["manual"] });

    const updated = await service.assignCaseForUser("case-1", "user-group-assignee", "dept-products", actor);

    expect(updated.assigneeId).toBe("user-group-assignee");
    expect(updated.departmentId).toBe("dept-payments");
    expect(auditEvents).toEqual([
      expect.objectContaining({
        action: "case.assigned",
        metadata: expect.objectContaining({
          fromDepartmentId: "dept-payments",
          toDepartmentId: "dept-payments"
        })
      })
    ]);
  });

  it("rejects assignment to users outside the case product", async () => {
    const { auditEvents, service } = makeDependencies(makeCase({ sourceSystem: "manual" }));
    const actor = makeUser({ id: "user-actor", productSourceKeys: ["manual"] });

    await expect(
      service.assignCaseForUser("case-1", "user-outside-product", "dept-payments", actor)
    ).rejects.toThrow("Assignee cannot access this product case");

    expect(auditEvents).toEqual([]);
  });

  it("adds internal notes and writes audit events", async () => {
    const { auditEvents, internalNotes, service } = makeDependencies();

    await service.addInternalNote("case-1", "Customer asked for an update before close of business.", "user-admin");

    expect(internalNotes).toEqual([
      {
        caseId: "case-1",
        body: "Customer asked for an update before close of business."
      }
    ]);
    expect(auditEvents).toEqual([
      expect.objectContaining({
        actorId: "user-admin",
        caseId: "case-1",
        action: "case.internal_note_added",
        metadata: expect.objectContaining({
          bodyLength: 54
        })
      })
    ]);
  });

  it("creates customer reply approval requests and writes audit events", async () => {
    const { approvalRequests, auditEvents, service } = makeDependencies();
    const user = makeUser({ roles: ["Customer Service"] });

    await service.requestCustomerReplyApprovalForUser(
      {
        caseId: "case-1",
        channel: "Email",
        draftBody: "We are looking into this and will update you shortly."
      },
      user
    );

    expect(approvalRequests).toEqual([
      {
        caseId: "case-1",
        channel: "Email",
        draftBody: "We are looking into this and will update you shortly.",
        requestedReviewerId: "user-product-manager"
      }
    ]);
    expect(auditEvents).toEqual([
      expect.objectContaining({
        actorId: user.id,
        caseId: "case-1",
        action: "case.customer_reply_review_requested",
        metadata: expect.objectContaining({
          approvalId: "approval-1",
          channel: "Email",
          requestedReviewerId: "user-product-manager",
          requestedReviewerName: "Product Manager"
        })
      })
    ]);
  });

  it("sends suggested customer replies directly and writes timeline audit events", async () => {
    const { approvedMessages, auditEvents, sentDeliveries, service, stageCustomerUpdates } = makeDependencies();
    const user = makeUser({ id: "user-product-manager", roles: ["Product Manager"] });

    await service.sendCustomerReplyForUser(
      {
        caseId: "case-1",
        channel: "Email",
        draftBody: "We are reviewing this and will update you shortly."
      },
      user
    );

    expect(approvedMessages).toEqual([
      {
        caseId: "case-1",
        channel: "Email",
        body: "We are reviewing this and will update you shortly.",
        deliveryStatus: "ACCEPTED"
      }
    ]);
    expect(sentDeliveries).toEqual([
      {
        caseId: "case-1",
        channel: "Email",
        recipient: "customer@example.com",
        subject: "Update on your case: Checkout failure",
        body: "We are reviewing this and will update you shortly."
      }
    ]);
    expect(stageCustomerUpdates).toEqual([
      {
        caseId: "case-1",
        incrementFollowUp: false
      }
    ]);
    expect(auditEvents).toEqual([
      expect.objectContaining({
        actorId: user.id,
        caseId: "case-1",
        action: "case.customer_reply_sent",
        metadata: expect.objectContaining({
          channel: "Email",
          body: "We are reviewing this and will update you shortly."
        })
      })
    ]);
  });

  it("denies customer reply approval requests outside the user's permissions", async () => {
    const { service } = makeDependencies(makeCase({ sourceSystem: "commerce-platform" }));

    await expect(
      service.requestCustomerReplyApprovalForUser(
        {
          caseId: "case-1",
          channel: "Email",
          draftBody: "We are looking into this and will update you shortly."
        },
        makeUser({ roles: ["Customer Service"], productSourceKeys: ["support-form"] })
      )
    ).rejects.toThrow("Current user cannot request customer reply approval for this case");
  });

  it("records dismissed customer reply suggestions without sending a message", async () => {
    const { approvedMessages, auditEvents, service } = makeDependencies();
    const user = makeUser({ id: "user-cs-1", roles: ["Customer Service"] });

    await service.dismissCustomerReplySuggestionForUser("case-1", user);

    expect(approvedMessages).toEqual([]);
    expect(auditEvents).toEqual([
      expect.objectContaining({
        actorId: "user-cs-1",
        caseId: "case-1",
        action: "case.customer_reply_suggestion_dismissed",
        metadata: expect.objectContaining({
          status: "New",
          priority: "High"
        })
      })
    ]);
  });

  it("sends routed reviewed customer replies and records the outbound message", async () => {
    const { approvedMessages, auditEvents, sentDeliveries, service } = makeDependencies();
    const requester = makeUser({ id: "user-requester", roles: ["Customer Service"] });
    const reviewer = makeUser({ id: "user-product-manager", roles: ["Product Manager"] });

    await service.requestCustomerReplyApprovalForUser(
      {
        caseId: "case-1",
        channel: "Email",
        draftBody: "We are still reviewing this and will share the next update today."
      },
      requester
    );

    await service.approveCustomerReplyForUser(
      "approval-1",
      reviewer,
      "We are still reviewing this and will share the next update today."
    );

    expect(approvedMessages).toEqual([
      {
        caseId: "case-1",
        channel: "Email",
        body: "We are still reviewing this and will share the next update today.",
        deliveryStatus: "ACCEPTED"
      }
    ]);
    expect(sentDeliveries).toEqual([
      {
        caseId: "case-1",
        channel: "Email",
        recipient: "customer@example.com",
        subject: "Update on your case: Checkout failure",
        body: "We are still reviewing this and will share the next update today."
      }
    ]);
    expect(auditEvents).toEqual([
      expect.objectContaining({
        actorId: "user-requester",
        caseId: "case-1",
        action: "case.customer_reply_review_requested"
      }),
      expect.objectContaining({
        actorId: "user-product-manager",
        caseId: "case-1",
        action: "case.customer_reply_sent",
        metadata: expect.objectContaining({
          approvalId: "approval-1",
          channel: "Email"
        })
      })
    ]);
  });

  it("denies customer reply decisions outside the user's case access", async () => {
    const { service } = makeDependencies(makeCase({ sourceSystem: "commerce-platform" }));

    await expect(
      service.approveCustomerReplyForUser(
        "approval-1",
        makeUser({ roles: ["Product User"], productSourceKeys: ["support-form"] })
      )
    ).rejects.toThrow("Current user cannot send reviewed customer replies for this case");
  });

  it("denies unprovisioned admins approving customer replies", async () => {
    const { service } = makeDependencies();

    await expect(
      service.approveCustomerReplyForUser(
        "approval-1",
        makeUser({ roles: ["Admin"], provisioned: false, productSourceKeys: ["manual"] })
      )
    ).rejects.toThrow("Current user cannot send reviewed customer replies for this case");
  });

  it("denies approval bypass when a different reviewer is routed", async () => {
    const { service } = makeDependencies();
    const requester = makeUser({ id: "user-requester", roles: ["Customer Service"] });

    await service.requestCustomerReplyApprovalForUser(
      {
        caseId: "case-1",
        channel: "Email",
        draftBody: "We are looking into this and will update you shortly."
      },
      requester
    );

    await expect(
      service.approveCustomerReplyForUser(
        "approval-1",
        makeUser({
          id: "user-other-product-manager",
          roles: ["Product Manager"],
          directProductSourceKeys: ["manual"],
          productSourceKeys: ["manual"]
        })
      )
    ).rejects.toThrow("Current user cannot send reviewed customer replies for this case");
  });

  it("does not create approval requests when no product manager reviewer is configured", async () => {
    const { approvalRequests, service } = makeDependencies(makeCase(), { reviewers: [] });

    await expect(
      service.requestCustomerReplyApprovalForUser(
        {
          caseId: "case-1",
          channel: "Email",
          draftBody: "We are looking into this and will update you shortly."
        },
        makeUser({ id: "user-requester", roles: ["Customer Service"] })
      )
    ).rejects.toThrow("No eligible product manager is configured to approve replies for this case");

    expect(approvalRequests).toEqual([]);
  });

  it("returns the configured product manager approval route for case users", async () => {
    const { service } = makeDependencies();

    await expect(
      service.getCustomerReplyApprovalRouteForUser("case-1", makeUser({ roles: ["Customer Service"] }))
    ).resolves.toEqual({
      reviewerId: "user-product-manager",
      reviewerName: "Product Manager"
    });
  });

  it("retries failed outbound customer messages through the provider", async () => {
    const { markedDeliveries, sentDeliveries, service } = makeDependencies();

    await expect(service.retryFailedCustomerMessages()).resolves.toEqual({
      attempted: 1,
      retried: 1,
      failed: 0
    });

    expect(sentDeliveries).toEqual([
      {
        caseId: "case-1",
        channel: "Email",
        recipient: "customer@example.com",
        subject: "Update on your case: Checkout failure",
        body: "Previous message failed."
      }
    ]);
    expect(markedDeliveries).toEqual([
      expect.objectContaining({
        messageId: "message-failed-1",
        providerMessageId: "provider-case-1",
        deliveryStatus: "ACCEPTED",
        deliveryError: null
      })
    ]);
  });

  it("retries failed product callbacks through the configured source callback", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetch);
    const { markedCallbacks, service } = makeDependencies(makeCase(), { callbacksEnabled: true });

    await expect(service.retryFailedProductCallbacks()).resolves.toEqual({
      attempted: 1,
      retried: 1,
      failed: 0
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://product.example.test/status",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-feedback-source": "manual",
          "x-feedback-signature": expect.any(String)
        })
      })
    );
    expect(markedCallbacks).toEqual([
      expect.objectContaining({
        attemptId: "callback-failed-1",
        status: "SENT",
        responseStatus: 200
      })
    ]);
  });

  it("records inbound customer replies for product-owned cases", async () => {
    const { auditEvents, inboundMessages, service } = makeDependencies(makeCase({ externalId: "COM-9001" }));

    const result = await service.recordInboundCustomerReplyForSource({
      sourceKey: "manual",
      caseId: "COM-9001",
      channel: "Email",
      body: "This is still failing.",
      externalMessageId: "email-123",
      customer: { email: "customer@example.com" }
    });

    expect(result.reopened).toBe(false);
    expect(result.message).toEqual(
      expect.objectContaining({
        direction: "inbound",
        body: "This is still failing.",
        externalMessageId: "email-123"
      })
    );
    expect(inboundMessages.at(-1)).toEqual({
      caseId: "case-1",
      channel: "Email",
      body: "This is still failing.",
      externalMessageId: "email-123"
    });
    expect(auditEvents).toContainEqual(
      expect.objectContaining({
        caseId: "case-1",
        action: "case.customer_reply_received",
        metadata: expect.objectContaining({
          channel: "Email",
          externalMessageId: "email-123",
          reopened: false
        })
      })
    );
  });

  it("reopens resolved cases when customers reply", async () => {
    const { auditEvents, callbackAttempts, service, stageTransitions } = makeDependencies(
      makeCase({ status: "Resolved", externalId: "COM-9001" }),
      { callbacksEnabled: true }
    );

    const result = await service.recordInboundCustomerReplyForSource({
      sourceKey: "manual",
      caseId: "COM-9001",
      channel: "SMS",
      body: "It is not fixed."
    });

    expect(result.reopened).toBe(true);
    expect(result.case.status).toBe("Reopened");
    expect(stageTransitions).toContainEqual(expect.objectContaining({ caseId: "case-1", status: "Reopened" }));
    expect(auditEvents).toContainEqual(
      expect.objectContaining({
        caseId: "case-1",
        action: "case.status_changed",
        metadata: expect.objectContaining({ from: "Resolved", to: "Reopened", reason: "customer_reply" })
      })
    );
    expect(callbackAttempts).toContainEqual(expect.objectContaining({ caseId: "case-1", eventType: "case.status_changed" }));
  });

  it("returns an initial customer reply suggestion for a new active stage", async () => {
    const { service } = makeDependencies();

    const suggestion = await service.getCustomerReplySuggestionForUser("case-1", makeUser());

    expect(suggestion).toEqual(
      expect.objectContaining({
        staleFollowUp: false,
        staleAfterHours: 72
      })
    );
  });

  it("suppresses suggestions after a stage update until the stale interval expires", async () => {
    const { service } = makeDependencies();
    const user = makeUser({ roles: ["Product Manager"] });

    await service.sendCustomerReplyForUser(
      {
        caseId: "case-1",
        channel: "Email",
        draftBody: "We are reviewing this and will update you shortly."
      },
      user
    );

    await expect(
      service.getCustomerReplySuggestionForUser("case-1", user, new Date("2026-07-08T12:05:00.000Z"))
    ).resolves.toBeNull();

    await expect(
      service.getCustomerReplySuggestionForUser("case-1", user, new Date("2026-07-11T12:05:00.000Z"))
    ).resolves.toEqual(expect.objectContaining({ staleFollowUp: true }));
  });
});
