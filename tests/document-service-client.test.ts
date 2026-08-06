import { afterEach, describe, expect, it, vi } from "vitest";
import { createConfiguredDocumentServiceClient, DocumentServiceClient } from "@/lib/document-service";

const originalEnv = process.env;

afterEach(() => {
  process.env = originalEnv;
});

function makeJsonResponse(payload: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Internal Server Error",
    json: async () => payload
  } as Response;
}

describe("DocumentServiceClient", () => {
  it("searches product knowledge with project_id product scope", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      makeJsonResponse({
        query: "checkout failure",
        results: [],
        total_results: 0
      })
    );
    const client = new DocumentServiceClient({
      baseUrl: "https://docs.example.test/",
      apiKey: "service-key",
      fetchImpl
    });

    await expect(
      client.searchProductKnowledge({
        query: "checkout failure",
        productSourceKey: "commerce-platform",
        documentType: "troubleshooting",
        topK: 3
      })
    ).resolves.toEqual({
      query: "checkout failure",
      results: [],
      total_results: 0
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://docs.example.test/documents/search",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          query: "checkout failure",
          document_id: undefined,
          document_type: "troubleshooting",
          project_id: "commerce-platform",
          top_k: 3
        })
      })
    );
    const headers = fetchImpl.mock.calls[0][1].headers as Headers;
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-service-key")).toBe("service-key");
  });

  it("creates configured client from FeedApp environment", () => {
    process.env = {
      ...originalEnv,
      DOCUMENT_SERVICE_URL: "https://docs.example.test",
      DOCUMENT_SERVICE_API_KEY: "service-key"
    };

    expect(createConfiguredDocumentServiceClient()).toBeInstanceOf(DocumentServiceClient);
  });

  it("fails clearly without a document service URL", () => {
    expect(() => new DocumentServiceClient({ baseUrl: "" })).toThrow("Document service URL is required");
  });

  it("surfaces document-service error details", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeJsonResponse({ detail: "Access denied" }, false));
    const client = new DocumentServiceClient({
      baseUrl: "https://docs.example.test",
      fetchImpl
    });

    await expect(
      client.searchProductKnowledge({
        query: "checkout failure",
        productSourceKey: "commerce-platform"
      })
    ).rejects.toThrow("Document service request failed: Access denied");
  });
});
