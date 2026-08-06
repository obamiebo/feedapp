import { NextResponse } from "next/server";
import { createFeedAppMcpTools } from "@/services/mcp-tools";

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

function jsonRpcResult(id: JsonRpcRequest["id"], result: unknown) {
  return NextResponse.json({
    jsonrpc: "2.0",
    id: id ?? null,
    result
  });
}

function jsonRpcError(id: JsonRpcRequest["id"], code: number, message: string) {
  return NextResponse.json({
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message
    }
  });
}

function isAuthorized(request: Request) {
  const configuredKey = process.env.FEEDBACK_MCP_API_KEY?.trim();
  if (!configuredKey) {
    return false;
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  return token === configuredKey;
}

export async function POST(request: Request) {
  let body: JsonRpcRequest;

  try {
    body = (await request.json()) as JsonRpcRequest;
  } catch {
    return jsonRpcError(null, -32700, "Parse error");
  }

  if (!isAuthorized(request)) {
    return jsonRpcError(body.id, -32001, "Unauthorized");
  }

  const mcpTools = createFeedAppMcpTools();

  try {
    if (body.method === "initialize") {
      return jsonRpcResult(body.id, {
        protocolVersion: "2025-03-26",
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "feedapp-mcp",
          version: "0.1.0"
        }
      });
    }

    if (body.method === "tools/list") {
      return jsonRpcResult(body.id, {
        tools: mcpTools.listTools()
      });
    }

    if (body.method === "tools/call") {
      const params = body.params ?? {};
      const name = typeof params.name === "string" ? params.name : "";
      const arguments_ =
        params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments)
          ? (params.arguments as Record<string, unknown>)
          : {};
      const result = await mcpTools.callTool(name, arguments_);
      return jsonRpcResult(body.id, result);
    }

    return jsonRpcError(body.id, -32601, "Method not found");
  } catch (error) {
    return jsonRpcError(body.id, -32000, error instanceof Error ? error.message : "Tool execution failed");
  }
}

export async function GET() {
  return NextResponse.json({
    service: "feedapp-mcp",
    status: process.env.FEEDBACK_MCP_API_KEY?.trim() ? "configured" : "missing-api-key"
  });
}
