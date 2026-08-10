export type ChatManagementRequest = {
  message: string;
  conversation_id?: string;
  context_options?: Record<string, unknown>;
  create_new?: boolean;
};

export type ChatManagementResponse = {
  message: string;
  conversation_id: string;
  message_id: string;
  content?: Array<Record<string, unknown>> | null;
  tool_used?: string | null;
  metadata?: Record<string, unknown>;
};

export type ChatManagementClient = {
  sendMessage(input: ChatManagementRequest, userSessionToken: string): Promise<ChatManagementResponse>;
};

export function createChatManagementClient(): ChatManagementClient {
  const baseUrl = process.env.CHAT_MANAGEMENT_API_URL?.trim();
  const appKey = process.env.CHAT_MANAGEMENT_APP_KEY?.trim();

  return {
    async sendMessage(input, userSessionToken) {
      if (!baseUrl) {
        throw new Error("CHAT_MANAGEMENT_API_URL is not configured");
      }

      if (!appKey) {
        throw new Error("CHAT_MANAGEMENT_APP_KEY is not configured");
      }

      if (!userSessionToken.trim()) {
        throw new Error("FeedApp session token is required for chat-management");
      }

      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat-v2/legacy`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${userSessionToken}`,
          "content-type": "application/json",
          "x-app-key": appKey
        },
        body: JSON.stringify({
          message: input.message,
          conversation_id: input.conversation_id,
          context_options: input.context_options ?? {},
          create_new: input.create_new ?? true
        })
      });

      if (!response.ok) {
        throw new Error(`chat-management returned ${response.status}`);
      }

      return (await response.json()) as ChatManagementResponse;
    }
  };
}
