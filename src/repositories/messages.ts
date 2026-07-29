import type { Approval, Message, MessageChannel, MessageDeliveryStatus, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppUser, MessageChannel as DomainMessageChannel } from "@/domain/types";
import { canEnterApplication, hasRole } from "@/lib/access-control";

export type OutboundMessageOperation = Message & {
  case: {
    id: string;
    title: string;
    sourceSystem: string;
    customer: {
      name: string | null;
      email: string | null;
      phone: string | null;
    };
  };
};

export type FailedOutboundMessage = OutboundMessageOperation;

export type PendingCustomerReplyApproval = Approval & {
  requestedReviewer: {
    name: string;
  } | null;
  case: {
    id: string;
    title: string;
    sourceSystem: string;
    priority: string;
    status: string;
    assigneeId: string | null;
    customer: {
      name: string | null;
    };
  };
};

export type MessageRepository = {
  createInternalNote(input: { caseId: string; body: string }): Promise<Message>;
  createApprovalRequest(input: {
    caseId: string;
    channel: DomainMessageChannel;
    draftBody: string;
    requestedReviewerId?: string | null;
  }): Promise<Approval>;
  getApprovalById(id: string): Promise<Approval | null>;
  approveRequest(input: { approvalId: string; approverId: string; reviewedBody: string }): Promise<Approval>;
  rejectRequest(input: { approvalId: string; approverId: string }): Promise<Approval>;
  createApprovedOutboundMessage(input: {
    caseId: string;
    channel: DomainMessageChannel;
    body: string;
    deliveryStatus?: MessageDeliveryStatus;
    deliveryError?: string;
  }): Promise<Message>;
  markOutboundDelivery(input: {
    messageId: string;
    providerMessageId?: string;
    deliveryStatus: Extract<MessageDeliveryStatus, "ACCEPTED" | "SENT" | "FAILED">;
    deliveryError?: string | null;
  }): Promise<Message>;
  listRecentOutboundMessages(limit?: number): Promise<OutboundMessageOperation[]>;
  listFailedOutboundMessages(limit?: number): Promise<FailedOutboundMessage[]>;
  listPendingCustomerReplyApprovalsForUser(user: AppUser, limit?: number): Promise<PendingCustomerReplyApproval[]>;
};

function mapMessageChannelToPrisma(channel: DomainMessageChannel): MessageChannel {
  if (channel === "SMS") return "SMS";
  if (channel === "Internal Note") return "INTERNAL_NOTE";
  return "EMAIL";
}

function approvalVisibilityWhere(user: AppUser) {
  if (!canEnterApplication(user)) {
    return { id: "__no_pending_approvals__" };
  }

  const conditions = [];

  if (hasRole(user, "Customer Service")) {
    conditions.push({ assigneeId: user.id });
  }

  if (user.productSourceKeys.length > 0) {
    conditions.push({ sourceSystem: { in: user.productSourceKeys } });
  }

  return conditions.length > 0 ? { OR: conditions } : { id: "__no_pending_approvals__" };
}

function pendingApprovalWhere(user: AppUser) {
  return {
    status: "PENDING" as const,
    requestedReviewerId: user.id,
    case: approvalVisibilityWhere(user)
  };
}

export function createPrismaMessageRepository(client: PrismaClient = prisma): MessageRepository {
  return {
    createInternalNote(input) {
      return client.message.create({
        data: {
          caseId: input.caseId,
          channel: "INTERNAL_NOTE",
          direction: "internal",
          approvalStatus: "APPROVED",
          body: input.body
        }
      });
    },

    createApprovalRequest(input) {
      return client.approval.create({
        data: {
          caseId: input.caseId,
          channel: mapMessageChannelToPrisma(input.channel),
          draftBody: input.draftBody,
          requestedReviewerId: input.requestedReviewerId
        }
      });
    },

    getApprovalById(id) {
      return client.approval.findUnique({ where: { id } });
    },

    approveRequest(input) {
      return client.approval.update({
        where: { id: input.approvalId },
        data: {
          approverId: input.approverId,
          status: "APPROVED",
          draftBody: input.reviewedBody,
          decidedAt: new Date()
        }
      });
    },

    rejectRequest(input) {
      return client.approval.update({
        where: { id: input.approvalId },
        data: {
          approverId: input.approverId,
          status: "REJECTED",
          decidedAt: new Date()
        }
      });
    },

    createApprovedOutboundMessage(input) {
      return client.message.create({
        data: {
          caseId: input.caseId,
          channel: mapMessageChannelToPrisma(input.channel),
          direction: "outbound",
          approvalStatus: "APPROVED",
          body: input.body,
          deliveryStatus: input.deliveryStatus ?? "ACCEPTED",
          deliveryError: input.deliveryError,
          deliveryAttempts: input.deliveryStatus === "FAILED" ? 1 : 0,
          lastDeliveryAttemptAt: input.deliveryStatus === "FAILED" ? new Date() : null
        }
      });
    },

    markOutboundDelivery(input) {
      return client.message.update({
        where: { id: input.messageId },
        data: {
          providerMessageId: input.providerMessageId,
          deliveryStatus: input.deliveryStatus,
          deliveryError: input.deliveryError,
          deliveryAttempts: { increment: 1 },
          lastDeliveryAttemptAt: new Date()
        }
      });
    },

    listRecentOutboundMessages(limit = 50) {
      return client.message.findMany({
        where: {
          direction: "outbound",
          approvalStatus: "APPROVED"
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          case: {
            select: {
              id: true,
              title: true,
              sourceSystem: true,
              customer: {
                select: {
                  name: true,
                  email: true,
                  phone: true
                }
              }
            }
          }
        }
      });
    },

    listFailedOutboundMessages(limit = 50) {
      return client.message.findMany({
        where: {
          direction: "outbound",
          approvalStatus: "APPROVED",
          deliveryStatus: "FAILED"
        },
        orderBy: { lastDeliveryAttemptAt: "asc" },
        take: limit,
        include: {
          case: {
            select: {
              id: true,
              title: true,
              sourceSystem: true,
              customer: {
                select: {
                  name: true,
                  email: true,
                  phone: true
                }
              }
            }
          }
        }
      });
    },

    listPendingCustomerReplyApprovalsForUser(user, limit = 20) {
      return client.approval.findMany({
        where: pendingApprovalWhere(user),
        orderBy: { createdAt: "asc" },
        take: limit,
        include: {
          requestedReviewer: {
            select: {
              name: true
            }
          },
          case: {
            select: {
              id: true,
              title: true,
              sourceSystem: true,
              priority: true,
              status: true,
              assigneeId: true,
              customer: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      });
    }
  };
}
