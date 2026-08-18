export type ProductKnowledgeDocumentType = "faq" | "manual" | "troubleshooting" | "release_note" | "policy";

export type DocumentServiceSearchInput = {
  query: string;
  productSourceKey: string;
  documentId?: string;
  documentType?: ProductKnowledgeDocumentType;
  topK?: number;
};

export type DocumentServiceSearchResult = {
  chunk_id: string;
  document_id: string;
  document_title: string;
  chunk_text: string;
  chunk_index: number;
  score: number;
  metadata?: Record<string, unknown>;
};

export type DocumentServiceSearchResponse = {
  query: string;
  results: DocumentServiceSearchResult[];
  total_results: number;
};

export type DocumentServiceUploadResponse = {
  task_id: string;
  document_id: string;
  title: string;
  file_size: number;
  mime_type: string;
  processing_status: string;
  message: string;
};

export type DocumentServiceStatusResponse = {
  task_id: string;
  status: string;
  stage: string;
  progress: number;
  message: string;
  timestamp: string | null;
  data?: Record<string, unknown>;
};

export type UploadTextProductKnowledgeInput = {
  text: string;
  productSourceKey: string;
  documentType: ProductKnowledgeDocumentType;
  title: string;
  documentId?: string;
  description?: string;
};

export type UploadFileProductKnowledgeInput = {
  file: Blob;
  filename?: string;
  productSourceKey: string;
  documentType: ProductKnowledgeDocumentType;
  title: string;
  documentId?: string;
  description?: string;
};

export type DocumentServiceClientOptions = {
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

export class DocumentServiceRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "DocumentServiceRequestError";
  }
}

export class DocumentServiceClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: DocumentServiceClientOptions) {
    const baseUrl = options.baseUrl.trim().replace(/\/+$/, "");
    if (!baseUrl) {
      throw new Error("Document service URL is required");
    }

    this.baseUrl = baseUrl;
    this.apiKey = options.apiKey?.trim() || undefined;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async searchProductKnowledge(input: DocumentServiceSearchInput): Promise<DocumentServiceSearchResponse> {
    return this.requestJson<DocumentServiceSearchResponse>("/documents/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: input.query,
        document_id: input.documentId,
        document_type: input.documentType,
        project_id: input.productSourceKey,
        top_k: input.topK ?? 5
      })
    });
  }

  async uploadTextProductKnowledge(input: UploadTextProductKnowledgeInput): Promise<DocumentServiceUploadResponse> {
    const body = new FormData();
    appendOptionalFormValue(body, "document_id", input.documentId);
    appendOptionalFormValue(body, "description", input.description);
    body.append("text", input.text);
    body.append("document_type", input.documentType);
    body.append("project_id", input.productSourceKey);
    body.append("title", input.title);

    return this.requestJson<DocumentServiceUploadResponse>("/documents/upload/text", {
      method: "POST",
      body
    });
  }

  async uploadFileProductKnowledge(input: UploadFileProductKnowledgeInput): Promise<DocumentServiceUploadResponse> {
    const body = new FormData();
    appendOptionalFormValue(body, "document_id", input.documentId);
    appendOptionalFormValue(body, "description", input.description);
    body.append("file", input.file, input.filename);
    body.append("document_type", input.documentType);
    body.append("project_id", input.productSourceKey);
    body.append("title", input.title);

    return this.requestJson<DocumentServiceUploadResponse>("/documents/upload/file", {
      method: "POST",
      body
    });
  }

  async getProcessingStatus(taskId: string): Promise<DocumentServiceStatusResponse> {
    return this.requestJson<DocumentServiceStatusResponse>(`/documents/status/${encodeURIComponent(taskId)}`);
  }

  async deleteDocument(documentId: string): Promise<{ message: string }> {
    return this.requestJson<{ message: string }>(`/documents/${encodeURIComponent(documentId)}`, {
      method: "DELETE"
    });
  }

  private async requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (this.apiKey) {
      headers.set("x-service-key", this.apiKey);
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers
    });

    if (!response.ok) {
      const message = await readErrorMessage(response);
      throw new DocumentServiceRequestError(`Document service request failed: ${message}`, response.status);
    }

    return (await response.json()) as T;
  }
}

export function createConfiguredDocumentServiceClient(): DocumentServiceClient {
  return new DocumentServiceClient({
    baseUrl: process.env.DOCUMENT_SERVICE_URL ?? "",
    apiKey: process.env.DOCUMENT_SERVICE_API_KEY
  });
}

function appendOptionalFormValue(body: FormData, key: string, value?: string) {
  if (value?.trim()) {
    body.append(key, value.trim());
  }
}

async function readErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as unknown;
    if (payload && typeof payload === "object" && "detail" in payload) {
      const detail = (payload as { detail?: unknown }).detail;
      return typeof detail === "string" ? detail : JSON.stringify(detail);
    }
  } catch {
    // Fall back to status text below.
  }

  return response.statusText || `HTTP ${response.status}`;
}
