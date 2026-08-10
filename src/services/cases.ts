import type { AppUser, FeedbackCase, MessageChannel } from "@/domain/types";
import type { AuditLogRepository } from "@/repositories/audit-logs";
import { createPrismaAuditLogRepository } from "@/repositories/audit-logs";
import type {
  CaseDetail,
  CaseListFilters,
  CaseListItem,
  CaseListPage,
  CaseListQuery,
  CaseRepository,
  CaseStatsSummary,
  CreateCaseRecord
} from "@/repositories/cases";
import { createPrismaCaseRepository } from "@/repositories/cases";
import type { CaseStageRepository } from "@/repositories/case-stages";
import type { StaleCaseStage } from "@/repositories/case-stages";
import { createPrismaCaseStageRepository } from "@/repositories/case-stages";
import type { CreateCustomerRecord, CustomerRepository } from "@/repositories/customers";
import { createPrismaCustomerRepository } from "@/repositories/customers";
import type { MessagingCadenceRepository } from "@/repositories/messaging-cadence";
import { createPrismaMessagingCadenceRepository } from "@/repositories/messaging-cadence";
import type { MessageRepository } from "@/repositories/messages";
import type { PendingCustomerReplyApproval } from "@/repositories/messages";
import { createPrismaMessageRepository } from "@/repositories/messages";
import type { IntegrationRepository } from "@/repositories/integrations";
import { createPrismaIntegrationRepository, getProductCallbackConfig } from "@/repositories/integrations";
import type { UserRepository } from "@/repositories/users";
import { createPrismaUserRepository } from "@/repositories/users";
import type { MessagingProvider } from "@/lib/messaging";
import { createConfiguredMessagingProvider } from "@/lib/messaging";
import type { SlaPolicyRepository } from "@/repositories/sla-policies";
import { createPrismaSlaPolicyRepository } from "@/repositories/sla-policies";
import { calculateSlaDeadline } from "@/lib/sla";
import { integrationSignatureHeader, integrationSourceHeader, signWebhookPayload } from "@/lib/integrations";
import { assertValidTransition } from "@/lib/workflow";
import {
  canAddInternalNote,
  canAssignCase,
  canBeAssignedToCase,
  canApproveCustomerReply,
  canCreateCase,
  canRequestCustomerReplyApproval,
  canTransitionCase,
  canViewCase,
  hasRole
} from "@/lib/access-control";

export type CaseService = {
  listCases(filters?: CaseListFilters): Promise<CaseListItem[]>;
  listCasesForUser(user: AppUser, filters?: CaseListFilters): Promise<CaseListItem[]>;
  listCasesPageForUser(user: AppUser, query?: CaseListQuery): Promise<CaseListPage>;
  getCaseStatsForUser(user: AppUser, filters?: CaseListFilters): Promise<CaseStatsSummary>;
  getCaseDetail(caseId: string): Promise<CaseDetail | null>;
  getCaseDetailForUser(caseId: string, user: AppUser): Promise<CaseDetail | null>;
  getCaseDetailAccessForUser(caseId: string, user: AppUser): Promise<
    | { status: "ok"; caseDetail: CaseDetail }
    | { status: "forbidden"; caseDetail: CaseDetail }
    | { status: "not-found" }
  >;
  createCase(input: CreateCaseRecord, actorId?: string): Promise<FeedbackCase>;
  createCaseForUser(input: CreateCaseRecord, user: AppUser): Promise<FeedbackCase>;
  getCaseBySourceExternalId(sourceSystem: string, externalId: string): Promise<FeedbackCase | null>;
  createManualCase(input: CreateManualCaseInput, actorId?: string): Promise<FeedbackCase>;
  createManualCaseForUser(input: CreateManualCaseInput, user: AppUser): Promise<FeedbackCase>;
  transitionCase(caseId: string, status: FeedbackCase["status"], actorId?: string): Promise<FeedbackCase>;
  transitionCaseForUser(caseId: string, status: FeedbackCase["status"], user: AppUser): Promise<FeedbackCase>;
  assignCase(caseId: string, assigneeId: string | null, departmentId?: string, actorId?: string): Promise<FeedbackCase>;
  assignCaseForUser(caseId: string, assigneeId: string | null, departmentId: string | undefined, user: AppUser): Promise<FeedbackCase>;
  addInternalNote(caseId: string, body: string, actorId?: string): Promise<void>;
  addInternalNoteForUser(caseId: string, body: string, user: AppUser): Promise<void>;
  sendCustomerReplyForUser(input: CustomerReplyApprovalInput, user: AppUser): Promise<void>;
  dismissCustomerReplySuggestionForUser(caseId: string, user: AppUser): Promise<void>;
  getCustomerReplySuggestionForUser(
    caseId: string,
    user: AppUser,
    now?: Date
  ): Promise<CustomerReplySuggestion | null>;
  listStaleCustomerUpdatePromptsForUser(user: AppUser, now?: Date): Promise<StaleCaseStage[]>;
  getCustomerReplyApprovalRouteForUser(caseId: string, user: AppUser): Promise<{ reviewerId: string; reviewerName: string } | null>;
  requestCustomerReplyApprovalForUser(input: CustomerReplyApprovalInput, user: AppUser): Promise<{ id: string }>;
  approveCustomerReplyForUser(approvalId: string, user: AppUser, reviewedBody?: string): Promise<void>;
  rejectCustomerReplyForUser(approvalId: string, user: AppUser): Promise<void>;
  recordInboundCustomerReplyForSource(input: {
    sourceKey: string;
    caseId: string;
    channel: Exclude<MessageChannel, "Internal Note">;
    body: string;
    externalMessageId?: string;
    customer?: {
      name?: string;
      email?: string;
      phone?: string;
    };
  }): Promise<{
    message: {
      id: string;
      channel: Exclude<MessageChannel, "Internal Note">;
      direction: string;
      body: string;
      externalMessageId: string | null;
      createdAt: Date;
    };
    case: FeedbackCase;
    reopened: boolean;
  }>;
  listPendingCustomerReplyApprovalsForUser(user: AppUser, limit?: number): Promise<PendingCustomerReplyApproval[]>;
  retryFailedCustomerMessages(limit?: number): Promise<{ attempted: number; retried: number; failed: number }>;
  retryFailedProductCallbacks(limit?: number): Promise<{ attempted: number; retried: number; failed: number }>;
};

export type CreateManualCaseInput = Omit<CreateCaseRecord, "customerId" | "sourceSystem"> & {
  customer: CreateCustomerRecord;
  sourceSystem?: string;
};

export type CustomerReplyApprovalInput = {
  caseId: string;
  channel: Exclude<MessageChannel, "Internal Note">;
  draftBody: string;
};

export type CustomerReplySuggestion = {
  caseDetail: CaseDetail;
  staleFollowUp: boolean;
  staleAfterHours: number;
};

type CaseServiceDependencies = {
  cases: CaseRepository;
  auditLogs: AuditLogRepository;
  customers: CustomerRepository;
  messages: MessageRepository;
  slaPolicies: SlaPolicyRepository;
  caseStages: CaseStageRepository;
  messagingCadence: MessagingCadenceRepository;
  users: UserRepository;
  messagingProvider: MessagingProvider;
  integrations: IntegrationRepository;
};

export function createCaseService(dependencies?: Partial<CaseServiceDependencies>): CaseService {
  const cases = dependencies?.cases ?? createPrismaCaseRepository();
  const auditLogs = dependencies?.auditLogs ?? createPrismaAuditLogRepository();
  const customers = dependencies?.customers ?? createPrismaCustomerRepository();
  const messages = dependencies?.messages ?? createPrismaMessageRepository();
  const slaPolicies = dependencies?.slaPolicies ?? createPrismaSlaPolicyRepository();
  const caseStages = dependencies?.caseStages ?? createPrismaCaseStageRepository();
  const messagingCadence = dependencies?.messagingCadence ?? createPrismaMessagingCadenceRepository();
  const users = dependencies?.users ?? createPrismaUserRepository();
  const messagingProvider = dependencies?.messagingProvider ?? createConfiguredMessagingProvider();
  const integrations = dependencies?.integrations ?? createPrismaIntegrationRepository();

  async function findReviewerForCase(feedbackCase: FeedbackCase, requester: AppUser) {
    const scopedUsers = await users.listAppUsersByProductSourceKey(feedbackCase.sourceSystem);
    const eligibleReviewers = scopedUsers.filter(
      (candidate) => candidate.id !== requester.id && candidate.provisioned && hasRole(candidate, "Product Manager")
    );

    const directProductManager = eligibleReviewers.find((candidate) =>
      candidate.directProductSourceKeys.includes(feedbackCase.sourceSystem)
    );

    if (directProductManager) {
      return directProductManager;
    }

    const scopedProductManager = eligibleReviewers.find((candidate) =>
      candidate.productSourceKeys.includes(feedbackCase.sourceSystem)
    );

    if (scopedProductManager) {
      return scopedProductManager;
    }

    return null;
  }

  function canDecideApprovalRequest(
    user: AppUser,
    feedbackCase: FeedbackCase,
    approval: { requestedReviewerId?: string | null }
  ) {
    if (!canApproveCustomerReply(user, feedbackCase)) {
      return false;
    }

    return Boolean(approval.requestedReviewerId) && user.id === approval.requestedReviewerId;
  }

  async function assertAssigneeCanWorkCase(assigneeId: string | null | undefined, feedbackCase: FeedbackCase) {
    if (!assigneeId) {
      return;
    }

    const assignee = await users.getAppUser(assigneeId);

    if (!assignee || !canBeAssignedToCase(assignee, feedbackCase)) {
      throw new Error("Assignee cannot access this product case");
    }
  }

  function resolveRecipient(
    caseDetail: CaseDetail,
    channel: Exclude<MessageChannel, "Internal Note">
  ): { recipient: string | null; error: string | null } {
    if (channel === "SMS") {
      return caseDetail.customer.phone
        ? { recipient: caseDetail.customer.phone, error: null }
        : { recipient: null, error: "Customer phone is not available" };
    }

    return caseDetail.customer.email
      ? { recipient: caseDetail.customer.email, error: null }
      : { recipient: null, error: "Customer email is not available" };
  }

  async function createAndDeliverCustomerMessage(input: {
    caseId: string;
    channel: Exclude<MessageChannel, "Internal Note">;
    body: string;
    subject?: string;
  }) {
    const caseDetail = await cases.getCaseDetail(input.caseId);

    if (!caseDetail) {
      throw new Error(`Case ${input.caseId} was not found`);
    }

    const { recipient, error } = resolveRecipient(caseDetail, input.channel);

    if (!recipient) {
      return messages.createApprovedOutboundMessage({
        caseId: input.caseId,
        channel: input.channel,
        body: input.body,
        deliveryStatus: "FAILED",
        deliveryError: error ?? "Customer recipient is not available"
      });
    }

    const message = await messages.createApprovedOutboundMessage({
      caseId: input.caseId,
      channel: input.channel,
      body: input.body,
      deliveryStatus: "ACCEPTED"
    });

    try {
      const result = await messagingProvider.send({
        caseId: input.caseId,
        channel: input.channel,
        recipient,
        subject: input.subject ?? `Update on your case: ${caseDetail.title}`,
        body: input.body
      });

      return messages.markOutboundDelivery({
        messageId: message.id,
        providerMessageId: result.providerMessageId,
        deliveryStatus: result.status === "failed" ? "FAILED" : result.status === "sent" ? "SENT" : "ACCEPTED",
        deliveryError: result.status === "failed" ? "Provider reported delivery failure" : null
      });
    } catch (error) {
      return messages.markOutboundDelivery({
        messageId: message.id,
        deliveryStatus: "FAILED",
        deliveryError: error instanceof Error ? error.message : "Provider delivery failed"
      });
    }
  }

  function preferredCustomerChannel(caseDetail: CaseDetail): Exclude<MessageChannel, "Internal Note"> | null {
    if (caseDetail.customer.email) return "Email";
    if (caseDetail.customer.phone) return "SMS";
    return null;
  }

  async function sendLifecycleMessage(input: {
    caseId: string;
    action: string;
    body: string;
    actorId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const caseDetail = await cases.getCaseDetail(input.caseId);

    if (!caseDetail) {
      return;
    }

    const channel = preferredCustomerChannel(caseDetail);

    if (!channel) {
      return;
    }

    const delivered = await createAndDeliverCustomerMessage({
      caseId: input.caseId,
      channel,
      subject: `Update on your case: ${caseDetail.title}`,
      body: input.body
    });

    await auditLogs.createAuditLog({
      actorId: input.actorId,
      caseId: input.caseId,
      action: input.action,
      metadata: {
        channel,
        messageId: delivered.id,
        deliveryStatus: delivered.deliveryStatus,
        ...input.metadata
      }
    });
  }

  async function sendNewCaseAcknowledgement(created: FeedbackCase, actorId?: string) {
    await sendLifecycleMessage({
      actorId,
      caseId: created.id,
      action: "case.customer_acknowledgement_sent",
      body: [
        `Thank you for contacting us about "${created.title}".`,
        "We have received your report and our team will review it.",
        `Your case reference is ${created.id}.`
      ].join("\n\n")
    });
  }

  async function recordInitialInboundFeedback(created: FeedbackCase) {
    const caseDetail = await cases.getCaseDetail(created.id);
    const channel = caseDetail ? (preferredCustomerChannel(caseDetail) ?? "Email") : "Email";

    await messages.createInboundCustomerMessage({
      caseId: created.id,
      channel,
      body: created.description
    });
  }

  async function sendResolutionNotification(updated: FeedbackCase, actorId?: string) {
    const closed = updated.status === "Closed";
    await sendLifecycleMessage({
      actorId,
      caseId: updated.id,
      action: closed ? "case.customer_closed_notification_sent" : "case.customer_resolved_notification_sent",
      body: closed
        ? [
            `Your case "${updated.title}" has now been closed.`,
            "If anything still does not look right, please contact our support team."
          ].join("\n\n")
        : [
            `Your case "${updated.title}" has been marked as resolved.`,
            "If the issue is still not resolved, please reply and our team will continue assisting you."
          ].join("\n\n"),
      metadata: {
        status: updated.status
      }
    });
  }

  function callbackPayload(feedbackCase: FeedbackCase, eventType: string) {
    return {
      eventType,
      case: {
        id: feedbackCase.id,
        externalId: feedbackCase.externalId ?? null,
        sourceSystem: feedbackCase.sourceSystem,
        status: feedbackCase.status,
        priority: feedbackCase.priority,
        assigneeId: feedbackCase.assigneeId ?? null,
        updatedAt: feedbackCase.updatedAt.toISOString()
      }
    };
  }

  async function deliverProductCallbackAttempt(input: {
    attemptId: string;
    sourceKey: string;
    callbackUrl: string;
    callbackSecret: string;
    payload: unknown;
  }) {
    const body = JSON.stringify(input.payload);
    const signature = signWebhookPayload(body, input.callbackSecret);

    try {
      const response = await fetch(input.callbackUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [integrationSourceHeader]: input.sourceKey,
          [integrationSignatureHeader]: signature
        },
        body
      });

      await integrations.markCallbackAttempt({
        attemptId: input.attemptId,
        status: response.ok ? "SENT" : "FAILED",
        responseStatus: response.status,
        lastError: response.ok ? null : `Callback returned ${response.status}`
      });

      return response.ok;
    } catch (error) {
      await integrations.markCallbackAttempt({
        attemptId: input.attemptId,
        status: "FAILED",
        lastError: error instanceof Error ? error.message : "Callback delivery failed"
      });

      return false;
    }
  }

  async function sendProductCallback(feedbackCase: FeedbackCase, eventType: string) {
    const source = await integrations.findSourceByKey(feedbackCase.sourceSystem);

    if (!source) {
      return;
    }

    const config = getProductCallbackConfig(source.config);

    if (!config.url || !config.secret) {
      return;
    }

    const payload = callbackPayload(feedbackCase, eventType);
    const attempt = await integrations.createCallbackAttempt({
      sourceId: source.id,
      caseId: feedbackCase.id,
      eventType,
      payload
    });

    await deliverProductCallbackAttempt({
      attemptId: attempt.id,
      sourceKey: source.key,
      callbackUrl: config.url,
      callbackSecret: config.secret,
      payload
    });
  }

  async function createCaseWithAudit(input: CreateCaseRecord, actorId?: string) {
    const policy = await slaPolicies.findPolicy(input.departmentId, input.priority);
    const now = new Date();
    const slaDeadlineAt = input.slaDeadlineAt ?? (policy ? calculateSlaDeadline(now, policy) : undefined);
    const created = await cases.createCase({
      ...input,
      slaDeadlineAt,
      dueAt: input.dueAt ?? slaDeadlineAt
    });

    await auditLogs.createAuditLog({
      actorId,
      caseId: created.id,
      action: "case.created",
      metadata: {
        priority: created.priority,
        departmentId: created.departmentId,
        sourceSystem: created.sourceSystem
      }
    });

    await caseStages.createInitialStage({
      caseId: created.id,
      status: created.status,
      priority: created.priority,
      startedAt: created.createdAt
    });

    await recordInitialInboundFeedback(created);
    await sendNewCaseAcknowledgement(created, actorId);

    return created;
  }

  function draftCaseForAuthorization(input: CreateCaseRecord): FeedbackCase {
    const now = new Date();

    return {
      id: "__new_case__",
      title: input.title,
      description: input.description,
      status: "New",
      priority: input.priority,
      departmentId: input.departmentId,
      customerId: input.customerId,
      sourceSystem: input.sourceSystem,
      externalId: input.externalId,
      assigneeId: input.assigneeId,
      dueAt: input.dueAt,
      slaDeadlineAt: input.slaDeadlineAt,
      createdAt: now,
      updatedAt: now
    };
  }

  function assertCanCreateProductCase(user: AppUser, input: CreateCaseRecord) {
    if (!canCreateCase(user) || !canViewCase(user, draftCaseForAuthorization(input))) {
      throw new Error("Current user cannot create cases for this product");
    }
  }

  function mapApprovalChannel(channel: string): Exclude<MessageChannel, "Internal Note"> {
    return channel === "SMS" ? "SMS" : "Email";
  }

  async function resolveProductCase(sourceKey: string, caseId: string) {
    const byExternalId = await cases.getCaseBySourceExternalId(sourceKey, caseId);

    if (byExternalId) {
      return byExternalId;
    }

    const byId = await cases.getCaseById(caseId);
    return byId?.sourceSystem === sourceKey ? byId : null;
  }

  return {
    listCases(filters) {
      return cases.listCases(filters);
    },

    async listCasesForUser(user, filters) {
      const records = await cases.listCases(filters);
      return records.filter((record) => canViewCase(user, record));
    },

    listCasesPageForUser(user, query) {
      return cases.listCasesPage(query, user);
    },

    getCaseStatsForUser(user, filters) {
      return cases.getCaseStats(filters, user);
    },

    getCaseDetail(caseId) {
      return cases.getCaseDetail(caseId);
    },

    async getCaseDetailForUser(caseId, user) {
      const detail = await cases.getCaseDetail(caseId);

      if (!detail || !canViewCase(user, detail)) {
        return null;
      }

      return detail;
    },

    async getCaseDetailAccessForUser(caseId, user) {
      const detail = await cases.getCaseDetail(caseId);

      if (!detail) {
        return { status: "not-found" };
      }

      if (!canViewCase(user, detail)) {
        return { status: "forbidden", caseDetail: detail };
      }

      return { status: "ok", caseDetail: detail };
    },

    createCase(input, actorId) {
      return createCaseWithAudit(input, actorId);
    },

    async createCaseForUser(input, user) {
      assertCanCreateProductCase(user, input);
      await assertAssigneeCanWorkCase(input.assigneeId, draftCaseForAuthorization(input));
      return createCaseWithAudit(input, user.id);
    },

    getCaseBySourceExternalId(sourceSystem, externalId) {
      return cases.getCaseBySourceExternalId(sourceSystem, externalId);
    },

    async createManualCase(input, actorId) {
      const customer = await customers.findOrCreateCustomer(input.customer);

      return createCaseWithAudit(
        {
          title: input.title,
          description: input.description,
          priority: input.priority,
          departmentId: input.departmentId,
          customerId: customer.id,
          sourceSystem: input.sourceSystem ?? "manual",
          externalId: input.externalId,
          assigneeId: input.assigneeId,
          dueAt: input.dueAt,
          slaDeadlineAt: input.slaDeadlineAt
        },
        actorId
      );
    },

    async createManualCaseForUser(input, user) {
      const sourceSystem = input.sourceSystem ?? "manual";
      const authCase = draftCaseForAuthorization({
        title: input.title,
        description: input.description,
        priority: input.priority,
        departmentId: input.departmentId,
        customerId: "__new_customer__",
        sourceSystem,
        externalId: input.externalId,
        assigneeId: input.assigneeId,
        dueAt: input.dueAt,
        slaDeadlineAt: input.slaDeadlineAt
      });

      if (!canCreateCase(user) || !canViewCase(user, authCase)) {
        throw new Error("Current user cannot create cases for this product");
      }

      await assertAssigneeCanWorkCase(input.assigneeId, authCase);

      const customer = await customers.findOrCreateCustomer(input.customer);

      return createCaseWithAudit(
        {
          title: input.title,
          description: input.description,
          priority: input.priority,
          departmentId: input.departmentId,
          customerId: customer.id,
          sourceSystem,
          externalId: input.externalId,
          assigneeId: input.assigneeId,
          dueAt: input.dueAt,
          slaDeadlineAt: input.slaDeadlineAt
        },
        user.id
      );
    },

    async transitionCase(caseId, status, actorId) {
      const existing = await cases.getCaseById(caseId);

      if (!existing) {
        throw new Error(`Case ${caseId} was not found`);
      }

      assertValidTransition(existing.status, status);
      const updated = await cases.updateStatus(caseId, status);
      await caseStages.transitionToStage({
        caseId,
        status: updated.status,
        priority: updated.priority,
        startedAt: updated.updatedAt
      });

      await auditLogs.createAuditLog({
        actorId,
        caseId,
        action: "case.status_changed",
        metadata: {
          from: existing.status,
          to: updated.status
        }
      });

      if (updated.status === "Resolved" || updated.status === "Closed") {
        await sendResolutionNotification(updated, actorId);
      }

      await sendProductCallback(updated, "case.status_changed");

      return updated;
    },

    async transitionCaseForUser(caseId, status, user) {
      const existing = await cases.getCaseById(caseId);

      if (!existing) {
        throw new Error(`Case ${caseId} was not found`);
      }

      if (!canTransitionCase(user, existing, status)) {
        throw new Error("Current user cannot transition this case");
      }

      assertValidTransition(existing.status, status);
      const updated = await cases.updateStatus(caseId, status);
      await caseStages.transitionToStage({
        caseId,
        status: updated.status,
        priority: updated.priority,
        startedAt: updated.updatedAt
      });

      await auditLogs.createAuditLog({
        actorId: user.id,
        caseId,
        action: "case.status_changed",
        metadata: {
          from: existing.status,
          to: updated.status
        }
      });

      if (updated.status === "Resolved" || updated.status === "Closed") {
        await sendResolutionNotification(updated, user.id);
      }

      await sendProductCallback(updated, "case.status_changed");

      return updated;
    },

    async assignCase(caseId, assigneeId, departmentId, actorId) {
      const existing = await cases.getCaseById(caseId);

      if (!existing) {
        throw new Error(`Case ${caseId} was not found`);
      }

      const updated = await cases.assignCase(caseId, assigneeId, departmentId);

      await auditLogs.createAuditLog({
        actorId,
        caseId,
        action: "case.assigned",
        metadata: {
          fromAssigneeId: existing.assigneeId ?? null,
          toAssigneeId: updated.assigneeId ?? null,
          fromDepartmentId: existing.departmentId,
          toDepartmentId: updated.departmentId
        }
      });

      await sendProductCallback(updated, "case.assigned");

      return updated;
    },

    async assignCaseForUser(caseId, assigneeId, departmentId, user) {
      void departmentId;
      const existing = await cases.getCaseById(caseId);

      if (!existing) {
        throw new Error(`Case ${caseId} was not found`);
      }

      if (!canAssignCase(user, existing)) {
        throw new Error("Current user cannot assign this case");
      }

      await assertAssigneeCanWorkCase(assigneeId, existing);

      const updated = await cases.assignCase(caseId, assigneeId, existing.departmentId);

      await auditLogs.createAuditLog({
        actorId: user.id,
        caseId,
        action: "case.assigned",
        metadata: {
          fromAssigneeId: existing.assigneeId ?? null,
          toAssigneeId: updated.assigneeId ?? null,
          fromDepartmentId: existing.departmentId,
          toDepartmentId: updated.departmentId
        }
      });

      await sendProductCallback(updated, "case.assigned");

      return updated;
    },

    async addInternalNote(caseId, body, actorId) {
      const existing = await cases.getCaseById(caseId);

      if (!existing) {
        throw new Error(`Case ${caseId} was not found`);
      }

      await messages.createInternalNote({ caseId, body });

      await auditLogs.createAuditLog({
        actorId,
        caseId,
        action: "case.internal_note_added",
        metadata: {
          bodyLength: body.length
        }
      });
    },

    async addInternalNoteForUser(caseId, body, user) {
      const existing = await cases.getCaseById(caseId);

      if (!existing) {
        throw new Error(`Case ${caseId} was not found`);
      }

      if (!canAddInternalNote(user, existing)) {
        throw new Error("Current user cannot add notes to this case");
      }

      await messages.createInternalNote({ caseId, body });

      await auditLogs.createAuditLog({
        actorId: user.id,
        caseId,
        action: "case.internal_note_added",
        metadata: {
          bodyLength: body.length
        }
      });
    },

    async sendCustomerReplyForUser(input, user) {
      const existing = await cases.getCaseById(input.caseId);

      if (!existing) {
        throw new Error(`Case ${input.caseId} was not found`);
      }

      if (!canApproveCustomerReply(user, existing)) {
        throw new Error("Current user cannot send customer replies for this case");
      }

      const body = input.draftBody.trim();
      const activeStage = await caseStages.findActiveStage(input.caseId);
      const delivered = await createAndDeliverCustomerMessage({
        caseId: input.caseId,
        channel: input.channel,
        body
      });
      await caseStages.markCustomerUpdate(input.caseId, {
        incrementFollowUp: Boolean(activeStage?.lastCustomerUpdateAt || activeStage?.lastPromptReviewedAt)
      });

      await auditLogs.createAuditLog({
        actorId: user.id,
        caseId: input.caseId,
        action: "case.customer_reply_sent",
        metadata: {
          channel: input.channel,
          body,
          messageId: delivered.id,
          deliveryStatus: delivered.deliveryStatus,
          draftLength: body.length
        }
      });
    },

    async dismissCustomerReplySuggestionForUser(caseId, user) {
      const existing = await cases.getCaseById(caseId);

      if (!existing) {
        throw new Error(`Case ${caseId} was not found`);
      }

      if (!canRequestCustomerReplyApproval(user, existing)) {
        throw new Error("Current user cannot dismiss customer reply suggestions for this case");
      }

      await caseStages.markPromptReviewed(caseId);
      await auditLogs.createAuditLog({
        actorId: user.id,
        caseId,
        action: "case.customer_reply_suggestion_dismissed",
        metadata: {
          status: existing.status,
          priority: existing.priority
        }
      });
    },

    async getCustomerReplySuggestionForUser(caseId, user, now = new Date()) {
      const caseDetail = await cases.getCaseDetail(caseId);

      if (!caseDetail || !canRequestCustomerReplyApproval(user, caseDetail)) {
        return null;
      }

      if (caseDetail.status === "Resolved" || caseDetail.status === "Closed") {
        return null;
      }

      const activeStage = await caseStages.findActiveStage(caseId);
      const policy = await messagingCadence.findPolicy(caseDetail.status, caseDetail.priority);

      if (!activeStage || !policy?.enabled) {
        return null;
      }

      const baseline = activeStage.lastCustomerUpdateAt ?? activeStage.lastPromptReviewedAt ?? activeStage.startedAt;
      const staleAt = new Date(baseline.getTime() + policy.staleAfterHours * 60 * 60 * 1000);
      const hasAlreadyHandledStage = Boolean(activeStage.lastCustomerUpdateAt || activeStage.lastPromptReviewedAt);

      if (hasAlreadyHandledStage && staleAt > now) {
        return null;
      }

      return {
        caseDetail,
        staleFollowUp: hasAlreadyHandledStage,
        staleAfterHours: policy.staleAfterHours
      };
    },

    async listStaleCustomerUpdatePromptsForUser(user, now = new Date()) {
      const staleStages = await caseStages.listStaleStages(now);
      return staleStages.filter((stage) => canViewCase(user, stage.case));
    },

    async getCustomerReplyApprovalRouteForUser(caseId, user) {
      const existing = await cases.getCaseById(caseId);

      if (!existing || !canRequestCustomerReplyApproval(user, existing)) {
        return null;
      }

      const reviewer = await findReviewerForCase(existing, user);
      return reviewer ? { reviewerId: reviewer.id, reviewerName: reviewer.name } : null;
    },

    async requestCustomerReplyApprovalForUser(input, user) {
      const existing = await cases.getCaseById(input.caseId);

      if (!existing) {
        throw new Error(`Case ${input.caseId} was not found`);
      }

      if (!canRequestCustomerReplyApproval(user, existing)) {
        throw new Error("Current user cannot request customer reply approval for this case");
      }

      const reviewer = await findReviewerForCase(existing, user);

      if (!reviewer) {
        throw new Error("No eligible product manager is configured to approve replies for this case");
      }

      const approval = await messages.createApprovalRequest({
        ...input,
        requestedReviewerId: reviewer.id
      });

      await auditLogs.createAuditLog({
        actorId: user.id,
        caseId: input.caseId,
        action: "case.customer_reply_review_requested",
        metadata: {
          approvalId: approval.id,
          channel: input.channel,
          draftLength: input.draftBody.length,
          requestedReviewerId: reviewer.id,
          requestedReviewerName: reviewer.name
        }
      });

      return { id: approval.id };
    },

    async approveCustomerReplyForUser(approvalId, user, reviewedBody) {
      const approval = await messages.getApprovalById(approvalId);

      if (!approval) {
        throw new Error(`Approval ${approvalId} was not found`);
      }

      const existing = await cases.getCaseById(approval.caseId);

      if (!existing) {
        throw new Error(`Case ${approval.caseId} was not found`);
      }

      if (!canDecideApprovalRequest(user, existing, approval)) {
        throw new Error("Current user cannot send reviewed customer replies for this case");
      }

      if (approval.status !== "PENDING") {
        throw new Error("Only pending approval requests can be approved");
      }

      const channel = mapApprovalChannel(approval.channel);
      const body = reviewedBody?.trim() || approval.draftBody;
      await messages.approveRequest({ approvalId, approverId: user.id, reviewedBody: body });
      const delivered = await createAndDeliverCustomerMessage({
        caseId: approval.caseId,
        channel,
        body
      });

      await auditLogs.createAuditLog({
        actorId: user.id,
        caseId: approval.caseId,
        action: "case.customer_reply_sent",
        metadata: {
          approvalId,
          channel,
          body,
          messageId: delivered.id,
          deliveryStatus: delivered.deliveryStatus,
          draftLength: body.length
        }
      });
    },

    async rejectCustomerReplyForUser(approvalId, user) {
      const approval = await messages.getApprovalById(approvalId);

      if (!approval) {
        throw new Error(`Approval ${approvalId} was not found`);
      }

      const existing = await cases.getCaseById(approval.caseId);

      if (!existing) {
        throw new Error(`Case ${approval.caseId} was not found`);
      }

      if (!canDecideApprovalRequest(user, existing, approval)) {
        throw new Error("Current user cannot decline customer replies for this case");
      }

      if (approval.status !== "PENDING") {
        throw new Error("Only pending approval requests can be rejected");
      }

      const channel = mapApprovalChannel(approval.channel);
      await messages.rejectRequest({ approvalId, approverId: user.id });

      await auditLogs.createAuditLog({
        actorId: user.id,
        caseId: approval.caseId,
        action: "case.customer_reply_declined",
        metadata: {
          approvalId,
          channel,
          draftLength: approval.draftBody.length
        }
      });
    },

    async recordInboundCustomerReplyForSource(input) {
      const existing = await resolveProductCase(input.sourceKey, input.caseId);

      if (!existing) {
        throw new Error("Case was not found for this product source");
      }

      const body = input.body.trim();
      const message = await messages.createInboundCustomerMessage({
        caseId: existing.id,
        channel: input.channel,
        body,
        externalMessageId: input.externalMessageId
      });
      const shouldReopen = existing.status === "Resolved" || existing.status === "Closed";
      const updated = shouldReopen ? await cases.updateStatus(existing.id, "Reopened") : existing;

      if (shouldReopen) {
        await caseStages.transitionToStage({
          caseId: existing.id,
          status: "Reopened",
          priority: existing.priority,
          startedAt: updated.updatedAt
        });
        await auditLogs.createAuditLog({
          caseId: existing.id,
          action: "case.status_changed",
          metadata: {
            from: existing.status,
            to: "Reopened",
            reason: "customer_reply"
          }
        });
        await sendProductCallback(updated, "case.status_changed");
      }

      await auditLogs.createAuditLog({
        caseId: existing.id,
        action: "case.customer_reply_received",
        metadata: {
          channel: input.channel,
          messageId: message.id,
          externalMessageId: input.externalMessageId,
          bodyLength: body.length,
          reopened: shouldReopen,
          customer: input.customer
        }
      });

      return {
        message: {
          id: message.id,
          channel: input.channel,
          direction: message.direction,
          body: message.body,
          externalMessageId: message.providerMessageId,
          createdAt: message.createdAt
        },
        case: updated,
        reopened: shouldReopen
      };
    },

    listPendingCustomerReplyApprovalsForUser(user, limit = 20) {
      return messages.listPendingCustomerReplyApprovalsForUser(user, limit);
    },

    async retryFailedCustomerMessages(limit = 50) {
      const failedMessages = await messages.listFailedOutboundMessages(limit);
      let retried = 0;
      let failed = 0;

      for (const message of failedMessages) {
        const channel = mapApprovalChannel(message.channel);
        const recipient = channel === "SMS" ? message.case.customer.phone : message.case.customer.email;

        if (!recipient) {
          failed += 1;
          await messages.markOutboundDelivery({
            messageId: message.id,
            deliveryStatus: "FAILED",
            deliveryError: channel === "SMS" ? "Customer phone is not available" : "Customer email is not available"
          });
          continue;
        }

        try {
          const result = await messagingProvider.send({
            caseId: message.caseId,
            channel,
            recipient,
            subject: `Update on your case: ${message.case.title}`,
            body: message.body
          });

          await messages.markOutboundDelivery({
            messageId: message.id,
            providerMessageId: result.providerMessageId,
            deliveryStatus: result.status === "failed" ? "FAILED" : result.status === "sent" ? "SENT" : "ACCEPTED",
            deliveryError: result.status === "failed" ? "Provider reported delivery failure" : null
          });

          if (result.status === "failed") {
            failed += 1;
          } else {
            retried += 1;
          }
        } catch (error) {
          failed += 1;
          await messages.markOutboundDelivery({
            messageId: message.id,
            deliveryStatus: "FAILED",
            deliveryError: error instanceof Error ? error.message : "Provider delivery failed"
          });
        }
      }

      return {
        attempted: failedMessages.length,
        retried,
        failed
      };
    },

    async retryFailedProductCallbacks(limit = 50) {
      const failedAttempts = await integrations.listFailedCallbackAttempts(limit);
      let retried = 0;
      let failed = 0;

      for (const attempt of failedAttempts) {
        const source = await integrations.findSourceByKey(attempt.sourceKey);
        const config = source ? getProductCallbackConfig(source.config) : { url: null, secret: null };

        if (!config.url || !config.secret) {
          failed += 1;
          await integrations.markCallbackAttempt({
            attemptId: attempt.id,
            status: "FAILED",
            lastError: "Callback URL or signing secret is not configured"
          });
          continue;
        }

        const delivered = await deliverProductCallbackAttempt({
          attemptId: attempt.id,
          sourceKey: attempt.sourceKey,
          callbackUrl: config.url,
          callbackSecret: config.secret,
          payload: attempt.payload
        });

        if (delivered) {
          retried += 1;
        } else {
          failed += 1;
        }
      }

      return {
        attempted: failedAttempts.length,
        retried,
        failed
      };
    }
  };
}
