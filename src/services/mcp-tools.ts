import type { AppUser, CaseStatus, MessageChannel, Priority } from "@/domain/types";
import { caseStatuses, priorities } from "@/domain/constants";
import type { CaseService } from "@/services/cases";
import { createCaseService } from "@/services/cases";
import type { ProductKnowledgeService } from "@/services/product-knowledge";
import { createProductKnowledgeService } from "@/services/product-knowledge";
import type { ProductKnowledgeDocumentType } from "@/repositories/product-knowledge";
import type { UserRepository } from "@/repositories/users";
import { createPrismaUserRepository } from "@/repositories/users";
import type { AuditLogRepository } from "@/repositories/audit-logs";
import { createPrismaAuditLogRepository } from "@/repositories/audit-logs";

type McpToolContent = {
  type: "text";
  text: string;
};

export type McpToolResult = {
  content: McpToolContent[];
};

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type FeedAppMcpTools = {
  listTools(): McpToolDefinition[];
  callTool(name: string, arguments_: Record<string, unknown>): Promise<McpToolResult>;
};

type FeedAppMcpToolDependencies = {
  cases: Pick<
    CaseService,
    | "getCaseDetailAccessForUser"
    | "requestCustomerReplyApprovalForUser"
    | "addInternalNoteForUser"
    | "getCaseStatsForUser"
    | "listCasesPageForUser"
  >;
  productKnowledge: Pick<ProductKnowledgeService, "searchForUser">;
  users: Pick<UserRepository, "getAppUser" | "listAssignableUsersByProductSourceKey">;
  auditLogs: AuditLogRepository;
};

const actorUserIdProperty = {
  type: "string",
  description: "FeedApp user ID for the staff member or bot actor whose permissions should be enforced."
};

const caseIdProperty = {
  type: "string",
  description: "FeedApp case ID."
};

const tools: McpToolDefinition[] = [
  {
    name: "get_feedback_counts",
    description: "Get permission-scoped feedback counts by status, priority, and SLA state.",
    inputSchema: {
      type: "object",
      properties: {
        actorUserId: actorUserIdProperty,
        sourceSystem: {
          type: "string",
          description: "Optional product source filter."
        },
        status: {
          type: "string",
          enum: ["New", "Assigned", "In Progress", "Resolved", "Closed", "Reopened"],
          description: "Optional case status filter."
        },
        priority: {
          type: "string",
          enum: ["Low", "Medium", "High", "Critical"],
          description: "Optional priority filter."
        }
      },
      required: ["actorUserId"]
    }
  },
  {
    name: "list_cases_by_status",
    description: "List permission-scoped FeedApp cases filtered by status, priority, product source, SLA state, or search text.",
    inputSchema: {
      type: "object",
      properties: {
        actorUserId: actorUserIdProperty,
        status: {
          type: "string",
          enum: ["New", "Assigned", "In Progress", "Resolved", "Closed", "Reopened"],
          description: "Optional case status filter."
        },
        priority: {
          type: "string",
          enum: ["Low", "Medium", "High", "Critical"],
          description: "Optional priority filter."
        },
        sourceSystem: {
          type: "string",
          description: "Optional product source filter."
        },
        slaState: {
          type: "string",
          enum: ["on-track", "at-risk", "breached"],
          description: "Optional SLA state filter."
        },
        search: {
          type: "string",
          description: "Optional search across case, customer, source, and description."
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 20,
          description: "Maximum number of cases to return."
        }
      },
      required: ["actorUserId"]
    }
  },
  {
    name: "recommend_case_next_action",
    description: "Recommend the next operational action for a permission-scoped FeedApp case. This does not change the case.",
    inputSchema: {
      type: "object",
      properties: {
        actorUserId: actorUserIdProperty,
        caseId: caseIdProperty
      },
      required: ["actorUserId", "caseId"]
    }
  },
  {
    name: "list_assignable_users_for_case",
    description: "List users who can be assigned to a permission-scoped FeedApp case.",
    inputSchema: {
      type: "object",
      properties: {
        actorUserId: actorUserIdProperty,
        caseId: caseIdProperty
      },
      required: ["actorUserId", "caseId"]
    }
  },
  {
    name: "get_case_context",
    description: "Get a permission-scoped FeedApp case context for drafting or support analysis.",
    inputSchema: {
      type: "object",
      properties: {
        actorUserId: actorUserIdProperty,
        caseId: caseIdProperty
      },
      required: ["actorUserId", "caseId"]
    }
  },
  {
    name: "search_product_knowledge",
    description: "Search product knowledge scoped to the product source of a FeedApp case.",
    inputSchema: {
      type: "object",
      properties: {
        actorUserId: actorUserIdProperty,
        caseId: caseIdProperty,
        query: {
          type: "string",
          description: "Search query based on the customer issue or reply need."
        },
        documentType: {
          type: "string",
          enum: ["faq", "manual", "troubleshooting", "release_note", "policy"],
          description: "Optional product knowledge document type filter."
        },
        topK: {
          type: "integer",
          minimum: 1,
          maximum: 20,
          description: "Number of chunks to return."
        }
      },
      required: ["actorUserId", "caseId", "query"]
    }
  },
  {
    name: "create_customer_reply_draft",
    description: "Create a draft customer reply approval request for a FeedApp case. This never sends the reply.",
    inputSchema: {
      type: "object",
      properties: {
        actorUserId: actorUserIdProperty,
        caseId: caseIdProperty,
        channel: {
          type: "string",
          enum: ["email", "sms"],
          description: "Customer reply channel."
        },
        draftBody: {
          type: "string",
          description: "Customer-facing draft body."
        }
      },
      required: ["actorUserId", "caseId", "channel", "draftBody"]
    }
  },
  {
    name: "add_internal_note",
    description: "Add an internal note to a FeedApp case for bot rationale or support context.",
    inputSchema: {
      type: "object",
      properties: {
        actorUserId: actorUserIdProperty,
        caseId: caseIdProperty,
        body: {
          type: "string",
          description: "Internal note body."
        }
      },
      required: ["actorUserId", "caseId", "body"]
    }
  }
];

export function createFeedAppMcpTools(dependencies?: Partial<FeedAppMcpToolDependencies>): FeedAppMcpTools {
  const cases = dependencies?.cases ?? createCaseService();
  const productKnowledge = dependencies?.productKnowledge ?? createProductKnowledgeService();
  const users = dependencies?.users ?? createPrismaUserRepository();
  const auditLogs = dependencies?.auditLogs ?? createPrismaAuditLogRepository();

  async function resolveActor(actorUserId: unknown): Promise<AppUser> {
    const id = stringArg(actorUserId, "actorUserId");
    const user = await users.getAppUser(id);
    if (!user || !user.provisioned) {
      throw new Error("Actor user was not found or is not provisioned");
    }
    return user;
  }

  async function resolveCaseForActor(caseId: unknown, actor: AppUser) {
    const id = stringArg(caseId, "caseId");
    const access = await cases.getCaseDetailAccessForUser(id, actor);
    if (access.status === "not-found") {
      throw new Error("Case was not found");
    }
    if (access.status === "forbidden") {
      throw new Error("Actor cannot access this case");
    }
    return access.caseDetail;
  }

  return {
    listTools() {
      return tools;
    },

    async callTool(name, arguments_) {
      const args = arguments_ ?? {};
      const actor = await resolveActor(args.actorUserId);

      if (name === "get_case_context") {
        const caseDetail = await resolveCaseForActor(args.caseId, actor);
        return textResult({
          case: caseDetail
        });
      }

      if (name === "get_feedback_counts") {
        const filters = {
          sourceSystem: optionalStringArg(args.sourceSystem),
          status: optionalCaseStatusArg(args.status),
          priority: optionalPriorityArg(args.priority)
        };
        const stats = await cases.getCaseStatsForUser(actor, filters);
        await auditLogs.createAuditLog({
          actorId: actor.id,
          action: "agent.feedback_counts_viewed",
          metadata: filters
        });
        return textResult({
          filters,
          stats
        });
      }

      if (name === "list_cases_by_status") {
        const limit = Math.min(Math.max(optionalNumberArg(args.limit) ?? 10, 1), 20);
        const filters = {
          status: optionalCaseStatusArg(args.status),
          priority: optionalPriorityArg(args.priority),
          sourceSystem: optionalStringArg(args.sourceSystem),
          slaState: optionalSlaStateArg(args.slaState),
          search: optionalStringArg(args.search),
          page: 1,
          pageSize: limit
        };
        const page = await cases.listCasesPageForUser(actor, filters);
        await auditLogs.createAuditLog({
          actorId: actor.id,
          action: "agent.case_list_viewed",
          metadata: {
            ...filters,
            returned: page.items.length,
            total: page.total
          }
        });
        return textResult({
          filters,
          total: page.total,
          cases: page.items.map((item) => ({
            id: item.id,
            title: item.title,
            status: item.status,
            priority: item.priority,
            sourceSystem: item.sourceSystem,
            assigneeName: item.assigneeName,
            customerName: item.customerName,
            slaDeadlineAt: item.slaDeadlineAt?.toISOString() ?? null,
            updatedAt: item.updatedAt.toISOString()
          }))
        });
      }

      if (name === "recommend_case_next_action") {
        const caseDetail = await resolveCaseForActor(args.caseId, actor);
        const recommendation = recommendNextAction(caseDetail);
        await auditLogs.createAuditLog({
          actorId: actor.id,
          caseId: caseDetail.id,
          action: "agent.case_next_action_recommended",
          metadata: {
            productSourceKey: caseDetail.sourceSystem,
            recommendation
          }
        });
        return textResult({
          caseId: caseDetail.id,
          productSourceKey: caseDetail.sourceSystem,
          recommendation
        });
      }

      if (name === "list_assignable_users_for_case") {
        const caseDetail = await resolveCaseForActor(args.caseId, actor);
        const assignableUsers = await users.listAssignableUsersByProductSourceKey(caseDetail.sourceSystem);
        await auditLogs.createAuditLog({
          actorId: actor.id,
          caseId: caseDetail.id,
          action: "agent.assignable_users_viewed",
          metadata: {
            productSourceKey: caseDetail.sourceSystem,
            returned: assignableUsers.length
          }
        });
        return textResult({
          caseId: caseDetail.id,
          productSourceKey: caseDetail.sourceSystem,
          users: assignableUsers
        });
      }

      if (name === "search_product_knowledge") {
        const caseDetail = await resolveCaseForActor(args.caseId, actor);
        const query = stringArg(args.query, "query");
        const documentType = optionalDocumentTypeArg(args.documentType);
        const topK = optionalNumberArg(args.topK);
        const result = await productKnowledge.searchForUser(
          {
            productSourceKey: caseDetail.sourceSystem,
            query,
            documentType,
            topK
          },
          actor
        );
        await auditLogs.createAuditLog({
          actorId: actor.id,
          caseId: caseDetail.id,
          action: "agent.product_knowledge_searched",
          metadata: {
            productSourceKey: caseDetail.sourceSystem,
            query,
            documentType: documentType ?? null,
            topK: topK ?? null,
            resultCount: Array.isArray((result as { results?: unknown }).results) ? (result as { results: unknown[] }).results.length : null
          }
        });
        return textResult({
          caseId: caseDetail.id,
          productSourceKey: caseDetail.sourceSystem,
          ...result
        });
      }

      if (name === "create_customer_reply_draft") {
        const caseDetail = await resolveCaseForActor(args.caseId, actor);
        const channel = parseReplyChannel(args.channel);
        const draftBody = stringArg(args.draftBody, "draftBody");
        const approval = await cases.requestCustomerReplyApprovalForUser(
          {
            caseId: caseDetail.id,
            channel,
            draftBody
          },
          actor
        );
        await auditLogs.createAuditLog({
          actorId: actor.id,
          caseId: caseDetail.id,
          action: "agent.customer_reply_draft_created",
          metadata: {
            approvalId: approval.id,
            channel,
            draftLength: draftBody.length,
            productSourceKey: caseDetail.sourceSystem,
            via: "mcp"
          }
        });
        return textResult({
          approvalId: approval.id,
          caseId: caseDetail.id,
          sent: false,
          status: "draft_created"
        });
      }

      if (name === "add_internal_note") {
        const caseDetail = await resolveCaseForActor(args.caseId, actor);
        await cases.addInternalNoteForUser(caseDetail.id, stringArg(args.body, "body"), actor);
        await auditLogs.createAuditLog({
          actorId: actor.id,
          caseId: caseDetail.id,
          action: "agent.internal_note_added",
          metadata: {
            productSourceKey: caseDetail.sourceSystem
          }
        });
        return textResult({
          caseId: caseDetail.id,
          status: "note_added"
        });
      }

      throw new Error(`Unknown tool: ${name}`);
    }
  };
}

function textResult(value: unknown): McpToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value)
      }
    ]
  };
}

function stringArg(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function optionalStringArg(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalDocumentTypeArg(value: unknown): ProductKnowledgeDocumentType | undefined {
  const documentType = optionalStringArg(value);
  if (!documentType) {
    return undefined;
  }

  if (["faq", "manual", "troubleshooting", "release_note", "policy"].includes(documentType)) {
    return documentType as ProductKnowledgeDocumentType;
  }

  throw new Error("documentType is not supported");
}

function optionalNumberArg(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function optionalCaseStatusArg(value: unknown): CaseStatus | undefined {
  const status = optionalStringArg(value);
  if (!status) return undefined;
  if (caseStatuses.includes(status as CaseStatus)) return status as CaseStatus;
  throw new Error("status is not supported");
}

function optionalPriorityArg(value: unknown): Priority | undefined {
  const priority = optionalStringArg(value);
  if (!priority) return undefined;
  if (priorities.includes(priority as Priority)) return priority as Priority;
  throw new Error("priority is not supported");
}

function optionalSlaStateArg(value: unknown): "on-track" | "at-risk" | "breached" | undefined {
  const slaState = optionalStringArg(value);
  if (!slaState) return undefined;
  if (["on-track", "at-risk", "breached"].includes(slaState)) {
    return slaState as "on-track" | "at-risk" | "breached";
  }
  throw new Error("slaState is not supported");
}

function parseReplyChannel(value: unknown): Exclude<MessageChannel, "Internal Note"> {
  const channel = stringArg(value, "channel").toLowerCase();
  if (channel === "sms") return "SMS";
  if (channel === "email") return "Email";
  throw new Error("channel must be email or sms");
}

function recommendNextAction(caseDetail: {
  status: CaseStatus;
  priority: Priority;
  assigneeId?: string;
  assigneeName: string | null;
  slaDeadlineAt?: Date;
}) {
  const now = new Date();
  const breached = Boolean(caseDetail.slaDeadlineAt && caseDetail.slaDeadlineAt < now);
  const atRisk = Boolean(
    caseDetail.slaDeadlineAt &&
      caseDetail.slaDeadlineAt >= now &&
      caseDetail.slaDeadlineAt <= new Date(now.getTime() + 4 * 60 * 60 * 1000)
  );

  if (caseDetail.status === "Closed") {
    return {
      action: "none",
      confidence: "high",
      reason: "The case is already closed."
    };
  }

  if (caseDetail.status === "Resolved") {
    return {
      action: "consider_close",
      confidence: "medium",
      reason: "The case is resolved. Customer Service can close it after confirming no further follow-up is needed."
    };
  }

  if (!caseDetail.assigneeId) {
    return {
      action: "assign_case",
      confidence: "high",
      reason: "The case is active but unassigned, so ownership should be set before further workflow movement."
    };
  }

  if (caseDetail.status === "New") {
    return {
      action: "move_to_assigned",
      confidence: "high",
      reason: `The case has an assignee (${caseDetail.assigneeName ?? caseDetail.assigneeId}) but is still New.`
    };
  }

  if (caseDetail.status === "Assigned") {
    return {
      action: "move_to_in_progress",
      confidence: "medium",
      reason: "The case has ownership. Move it to In Progress once investigation work has started."
    };
  }

  if (breached) {
    return {
      action: "escalate_or_update_customer",
      confidence: "high",
      reason: "The case has breached its SLA deadline and should be escalated or updated."
    };
  }

  if (atRisk) {
    return {
      action: "prioritize_or_update_customer",
      confidence: "medium",
      reason: "The case is close to its SLA deadline and should be prioritized."
    };
  }

  return {
    action: "continue_work",
    confidence: "medium",
    reason: "The case is active, assigned, and not currently at SLA risk."
  };
}
