import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser } from "@/domain/types";
import { createChatManagementClient } from "@/lib/chat-management";
import { resolveCurrentUser } from "@/lib/current-user";
import { getSessionToken } from "@/lib/session-cookie";
import { POST } from "@/app/api/agent/chat/route";

vi.mock("@/lib/chat-management", () => ({
  createChatManagementClient: vi.fn()
}));

vi.mock("@/lib/current-user", () => ({
  resolveCurrentUser: vi.fn()
}));

vi.mock("@/lib/session-cookie", () => ({
  getSessionToken: vi.fn()
}));

const originalEnv = process.env;

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "user-1",
    email: "user@example.com",
    name: "User",
    roles: ["Customer Service"],
    departmentIds: ["dept-1"],
    directProductSourceKeys: ["commerce-platform"],
    productSourceKeys: ["commerce-platform"],
    productGroupIds: [],
    provisioned: true,
    ...overrides
  };
}

function request(body: unknown) {
  return new Request("http://localhost/api/agent/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env = {
    ...originalEnv,
    FEEDBACK_AGENT_ENABLED: "true"
  };
  vi.mocked(resolveCurrentUser).mockResolvedValue(makeUser());
  vi.mocked(getSessionToken).mockResolvedValue("session-token");
  vi.mocked(createChatManagementClient).mockReturnValue({
    sendMessage: vi.fn().mockResolvedValue({
      message: "There are 2 new cases.",
      conversation_id: "conversation-1",
      message_id: "message-1",
      metadata: {},
      content: null,
      tool_used: "get_feedback_counts"
    })
  });
});

describe("/api/agent/chat", () => {
  it("rejects requests when the feedback agent is disabled", async () => {
    process.env.FEEDBACK_AGENT_ENABLED = "false";

    const response = await POST(request({ message: "How many new cases?" }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Feedback agent is disabled");
  });

  it("sends dashboard chat through chat-management with FeedApp instructions", async () => {
    const client = {
      sendMessage: vi.fn().mockResolvedValue({
        message: "There are 2 new cases.",
        conversation_id: "conversation-1",
        message_id: "message-1",
        metadata: {},
        content: null,
        tool_used: "get_feedback_counts"
      })
    };
    vi.mocked(createChatManagementClient).mockReturnValue(client);

    const response = await POST(request({ message: "How many new cases?" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(client.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("How many new cases?"),
        context_options: expect.objectContaining({
          feedapp_actor_user_id: "user-1",
          feedapp_task: "dashboard_chat"
        }),
        create_new: true
      }),
      "session-token"
    );
    expect(client.sendMessage.mock.calls[0][0].message).toContain("pass this actorUserId exactly:");
    expect(body).toMatchObject({
      message: "There are 2 new cases.",
      conversationId: "conversation-1",
      toolUsed: "get_feedback_counts"
    });
  });

  it("returns proposed actions from chat-management metadata", async () => {
    vi.mocked(createChatManagementClient).mockReturnValue({
      sendMessage: vi.fn().mockResolvedValue({
        message: "I recommend moving case-1 to Assigned.",
        conversation_id: "conversation-1",
        message_id: "message-1",
        metadata: {
          proposedActions: [
            {
              type: "transition_case",
              caseId: "case-1",
              toStatus: "Assigned",
              reason: "The case has an owner."
            }
          ]
        },
        content: null
      })
    });

    const response = await POST(request({ message: "What should happen next?" }));
    const body = await response.json();

    expect(body.proposedActions).toEqual([
      expect.objectContaining({
        type: "transition_case",
        caseId: "case-1",
        toStatus: "Assigned"
      })
    ]);
  });

  it("continues an existing conversation when a conversation ID is provided", async () => {
    const client = {
      sendMessage: vi.fn().mockResolvedValue({
        message: "Continuing.",
        conversation_id: "conversation-1",
        message_id: "message-2",
        metadata: {},
        content: null
      })
    };
    vi.mocked(createChatManagementClient).mockReturnValue(client);

    await POST(request({ message: "List them", conversationId: "conversation-1" }));

    expect(client.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: "conversation-1",
        create_new: false
      }),
      "session-token"
    );
  });
});
