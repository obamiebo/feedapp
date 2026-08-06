import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFeedAppMcpTools } from "@/services/mcp-tools";
import { POST } from "@/app/api/mcp/route";

vi.mock("@/services/mcp-tools", () => ({
  createFeedAppMcpTools: vi.fn()
}));

const originalEnv = process.env;

beforeEach(() => {
  vi.resetAllMocks();
  process.env = {
    ...originalEnv,
    FEEDBACK_MCP_API_KEY: "mcp-key"
  };
  vi.mocked(createFeedAppMcpTools).mockReturnValue({
    listTools: () => [{ name: "get_case_context", description: "Get case", inputSchema: { type: "object" } }],
    callTool: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "{}" }] })
  });
});

function request(payload: unknown, token = "mcp-key") {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

describe("/api/mcp", () => {
  it("rejects missing or invalid service token", async () => {
    const response = await POST(request({ jsonrpc: "2.0", id: 1, method: "tools/list" }, "wrong"));
    const body = await response.json();

    expect(body.error).toMatchObject({ code: -32001, message: "Unauthorized" });
  });

  it("returns MCP tool definitions", async () => {
    const response = await POST(request({ jsonrpc: "2.0", id: 1, method: "tools/list" }));
    const body = await response.json();

    expect(body.result.tools).toEqual([
      {
        name: "get_case_context",
        description: "Get case",
        inputSchema: { type: "object" }
      }
    ]);
  });

  it("dispatches tool calls", async () => {
    const toolService = {
      listTools: vi.fn(),
      callTool: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "{\"ok\":true}" }] })
    };
    vi.mocked(createFeedAppMcpTools).mockReturnValue(toolService);

    const response = await POST(
      request({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "get_case_context",
          arguments: { actorUserId: "user-1", caseId: "case-1" }
        }
      })
    );
    const body = await response.json();

    expect(toolService.callTool).toHaveBeenCalledWith("get_case_context", { actorUserId: "user-1", caseId: "case-1" });
    expect(body.result.content[0].text).toBe("{\"ok\":true}");
  });
});
