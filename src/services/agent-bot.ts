import type { AppUser, MessageChannel } from "@/domain/types";
import type { AuditLogRepository } from "@/repositories/audit-logs";
import { createPrismaAuditLogRepository } from "@/repositories/audit-logs";
import type { CaseService } from "@/services/cases";
import { createCaseService } from "@/services/cases";
import type { ChatManagementClient, ChatManagementResponse } from "@/lib/chat-management";
import { createChatManagementClient } from "@/lib/chat-management";
import { canRequestCustomerReplyApproval } from "@/lib/access-control";

export type BotReplyGenerationResult = {
  approvalId: string;
  runId: string | null;
  conversationId: string | null;
  messageId: string | null;
  draftBody: string;
  rationale: string | null;
};

type AgentBotServiceDependencies = {
  cases: Pick<CaseService, "getCaseDetailAccessForUser" | "requestCustomerReplyApprovalForUser">;
  chatManagement: ChatManagementClient;
  auditLogs: AuditLogRepository;
};

export type AgentBotService = {
  generateCustomerReplyDraftForUser(
    input: { caseId: string; channel: Exclude<MessageChannel, "Internal Note">; userSessionToken: string },
    user: AppUser
  ): Promise<BotReplyGenerationResult>;
};

export function isFeedbackAgentEnabled() {
  return process.env.FEEDBACK_AGENT_ENABLED === "true";
}

export function createAgentBotService(dependencies?: Partial<AgentBotServiceDependencies>): AgentBotService {
  const cases = dependencies?.cases ?? createCaseService();
  const chatManagement = dependencies?.chatManagement ?? createChatManagementClient();
  const auditLogs = dependencies?.auditLogs ?? createPrismaAuditLogRepository();

  return {
    async generateCustomerReplyDraftForUser(input, user) {
      if (!isFeedbackAgentEnabled()) {
        throw new Error("Feedback agent is disabled");
      }

      const caseAccess = await cases.getCaseDetailAccessForUser(input.caseId, user);
      if (caseAccess.status === "not-found") {
        throw new Error(`Case ${input.caseId} was not found`);
      }
      if (caseAccess.status === "forbidden") {
        throw new Error("Current user cannot access this case");
      }

      const caseDetail = caseAccess.caseDetail;
      if (!canRequestCustomerReplyApproval(user, caseDetail)) {
        throw new Error("Current user cannot generate customer reply drafts for this case");
      }

      const startedAt = Date.now();
      await auditLogs.createAuditLog({
        actorId: user.id,
        caseId: caseDetail.id,
        action: "agent.customer_reply_requested",
        metadata: {
          channel: input.channel,
          productSourceKey: caseDetail.sourceSystem
        }
      });

      try {
        const chatResponse = await chatManagement.sendMessage(
          {
            message: buildBotPrompt({
              actorUserId: user.id,
              caseId: caseDetail.id,
              channel: input.channel
            }),
            context_options: {
              feedapp_case_id: caseDetail.id,
              feedapp_product_source: caseDetail.sourceSystem,
              feedapp_actor_user_id: user.id,
              feedapp_task: "customer_reply_draft"
            },
            create_new: true
          },
          input.userSessionToken
        );

        const extracted = extractBotResponse(chatResponse);
        const approval =
          extracted.approvalId ??
          (
            await cases.requestCustomerReplyApprovalForUser(
              {
                caseId: caseDetail.id,
                channel: input.channel,
                draftBody: extracted.draftBody
              },
              user
            )
          ).id;

        await auditLogs.createAuditLog({
          actorId: user.id,
          caseId: caseDetail.id,
          action: "agent.customer_reply_draft_created",
          metadata: {
            approvalId: approval,
            runId: extracted.runId,
            conversationId: chatResponse.conversation_id,
            messageId: chatResponse.message_id,
            channel: input.channel,
            draftLength: extracted.draftBody.length,
            latencyMs: Date.now() - startedAt,
            productSourceKey: caseDetail.sourceSystem,
            toolUsed: chatResponse.tool_used ?? null,
            toolCalls: extracted.toolCalls
          }
        });

        return {
          approvalId: approval,
          runId: extracted.runId ?? null,
          conversationId: chatResponse.conversation_id,
          messageId: chatResponse.message_id,
          draftBody: extracted.draftBody,
          rationale: extracted.rationale ?? null
        };
      } catch (error) {
        await auditLogs.createAuditLog({
          actorId: user.id,
          caseId: caseDetail.id,
          action: "agent.customer_reply_failed",
          metadata: {
            channel: input.channel,
            productSourceKey: caseDetail.sourceSystem,
            latencyMs: Date.now() - startedAt,
            failureReason: error instanceof Error ? error.message : "Bot reply generation failed"
          }
        });
        throw error;
      }
    }
  };
}

function buildBotPrompt(input: { actorUserId: string; caseId: string; channel: Exclude<MessageChannel, "Internal Note"> }) {
  return [
    "Generate a concise, empathetic customer-facing reply draft for this FeedApp case.",
    "Use FeedApp MCP tools only for case context, product knowledge, notes, and draft creation.",
    "Create a draft approval request with create_customer_reply_draft; do not send a customer message, transition the case, or assign the case.",
    "Add internal rationale only if it helps the support team.",
    "Return JSON with draftBody, rationale, approvalId if a tool created one, runId if available, and toolCalls if available.",
    `actorUserId: ${input.actorUserId}`,
    `caseId: ${input.caseId}`,
    `channel: ${input.channel}`
  ].join("\n");
}

function extractBotResponse(response: ChatManagementResponse) {
  const metadata = response.metadata ?? {};
  const contentJson = firstJsonObject(response.content);
  const messageJson = parseJsonObject(response.message);
  const merged = {
    ...metadata,
    ...contentJson,
    ...messageJson
  };

  const draftBody = stringValue(merged.draftBody) ?? stringValue(merged.draft_body) ?? response.message.trim();
  if (draftBody.length < 3) {
    throw new Error("Bot response did not include a usable reply draft");
  }

  return {
    approvalId: stringValue(merged.approvalId) ?? stringValue(merged.approval_id),
    runId: stringValue(merged.runId) ?? stringValue(merged.run_id),
    rationale: stringValue(merged.rationale),
    draftBody,
    toolCalls: Array.isArray(merged.toolCalls) ? merged.toolCalls : Array.isArray(merged.tool_calls) ? merged.tool_calls : []
  };
}

function firstJsonObject(content: Array<Record<string, unknown>> | null | undefined) {
  if (!content) return {};

  for (const item of content) {
    const direct = item.json ?? item.data;
    if (direct && typeof direct === "object" && !Array.isArray(direct)) {
      return direct as Record<string, unknown>;
    }

    const text = stringValue(item.text) ?? stringValue(item.body);
    const parsed = text ? parseJsonObject(text) : null;
    if (parsed) return parsed;
  }

  return {};
}

function parseJsonObject(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
