import { NextResponse } from "next/server";
import { parseProposedActionsFromChatPayload } from "@/lib/agent-actions";
import { canEnterApplication } from "@/lib/access-control";
import { createChatManagementClient } from "@/lib/chat-management";
import { resolveCurrentUser } from "@/lib/current-user";
import { getSessionToken } from "@/lib/session-cookie";
import { isFeedbackAgentEnabled } from "@/services/agent-bot";

type AgentChatRequest = {
  message?: unknown;
  conversationId?: unknown;
};

export async function POST(request: Request) {
  if (!isFeedbackAgentEnabled()) {
    return NextResponse.json({ error: "Feedback agent is disabled" }, { status: 403 });
  }

  const [currentUser, sessionToken] = await Promise.all([resolveCurrentUser(), getSessionToken()]);

  if (!currentUser || !sessionToken) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!canEnterApplication(currentUser) || currentUser.passwordMustChange) {
    return NextResponse.json({ error: "Application access required" }, { status: 403 });
  }

  let body: AgentChatRequest;
  try {
    body = (await request.json()) as AgentChatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const conversationId = typeof body.conversationId === "string" && body.conversationId.trim() ? body.conversationId.trim() : undefined;

  if (message.length < 1) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  try {
    const response = await createChatManagementClient().sendMessage(
      {
        message: buildOperationalChatPrompt(message, currentUser.id),
        conversation_id: conversationId,
        context_options: {
          feedapp_actor_user_id: currentUser.id,
          feedapp_task: "dashboard_chat"
        },
        create_new: !conversationId
      },
      sessionToken
    );

    const proposedActions = parseProposedActionsFromChatPayload({
      message: response.message,
      metadata: response.metadata ?? {},
      content: response.content ?? null
    });

    return NextResponse.json({
      message: response.message,
      conversationId: response.conversation_id,
      messageId: response.message_id,
      content: response.content ?? null,
      metadata: response.metadata ?? {},
      proposedActions,
      toolUsed: response.tool_used ?? null
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Agent chat failed" },
      { status: 502 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: "feedapp-agent-chat",
    enabled: isFeedbackAgentEnabled(),
    chatManagementConfigured: Boolean(process.env.CHAT_MANAGEMENT_API_URL?.trim() && process.env.CHAT_MANAGEMENT_APP_KEY?.trim())
  });
}

function buildOperationalChatPrompt(message: string, actorUserId: string) {
  return [
    "You are the FeedApp operational assistant inside the staff dashboard.",
    "Use FeedApp MCP tools for case counts, case lists, case context, product knowledge, recommendations, notes, and draft creation.",
    "When calling a FeedApp MCP tool, pass this actorUserId exactly:",
    actorUserId,
    "You may answer read-only operational questions and recommend next actions.",
    "Do not transition case status, assign cases, or send customer messages unless FeedApp provides an explicit confirmation flow.",
    "When recommending an action, explain the reason and name the case ID.",
    "For executable case status or assignment recommendations, include metadata or JSON with a proposedActions array.",
    "Supported action shapes:",
    '{"type":"transition_case","caseId":"CASE_ID","toStatus":"Assigned|In Progress|Resolved|Closed|Reopened","reason":"..."}',
    '{"type":"assign_case","caseId":"CASE_ID","assigneeId":"USER_ID_OR_NULL","assigneeName":"Name","reason":"..."}',
    "Use list_assignable_users_for_case before proposing assign_case so assigneeId is exact.",
    "",
    "Staff message:",
    message
  ].join("\n");
}
