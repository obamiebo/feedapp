import type { AppUser, MessageChannel } from "@/domain/types";
import type { CaseService } from "@/services/cases";
import { createCaseService } from "@/services/cases";
import type { ProductKnowledgeService } from "@/services/product-knowledge";
import { createProductKnowledgeService } from "@/services/product-knowledge";
import type { ProductKnowledgeDocumentType } from "@/repositories/product-knowledge";
import type { UserRepository } from "@/repositories/users";
import { createPrismaUserRepository } from "@/repositories/users";

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
    "getCaseDetailAccessForUser" | "requestCustomerReplyApprovalForUser" | "addInternalNoteForUser"
  >;
  productKnowledge: Pick<ProductKnowledgeService, "searchForUser">;
  users: Pick<UserRepository, "getAppUser">;
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

      if (name === "search_product_knowledge") {
        const caseDetail = await resolveCaseForActor(args.caseId, actor);
        const result = await productKnowledge.searchForUser(
          {
            productSourceKey: caseDetail.sourceSystem,
            query: stringArg(args.query, "query"),
            documentType: optionalDocumentTypeArg(args.documentType),
            topK: optionalNumberArg(args.topK)
          },
          actor
        );
        return textResult({
          caseId: caseDetail.id,
          productSourceKey: caseDetail.sourceSystem,
          ...result
        });
      }

      if (name === "create_customer_reply_draft") {
        const caseDetail = await resolveCaseForActor(args.caseId, actor);
        const approval = await cases.requestCustomerReplyApprovalForUser(
          {
            caseId: caseDetail.id,
            channel: parseReplyChannel(args.channel),
            draftBody: stringArg(args.draftBody, "draftBody")
          },
          actor
        );
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

function parseReplyChannel(value: unknown): Exclude<MessageChannel, "Internal Note"> {
  const channel = stringArg(value, "channel").toLowerCase();
  if (channel === "sms") return "SMS";
  if (channel === "email") return "Email";
  throw new Error("channel must be email or sms");
}
