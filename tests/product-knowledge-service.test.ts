import { describe, expect, it, vi } from "vitest";
import type { AppUser } from "@/domain/types";
import type { IntegrationRepository } from "@/repositories/integrations";
import type { ProductKnowledgeRepository } from "@/repositories/product-knowledge";
import { createProductKnowledgeService } from "@/services/product-knowledge";

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "user-1",
    email: "user@example.com",
    name: "User",
    roles: ["Product User"],
    departmentIds: ["dept-1"],
    directProductSourceKeys: ["commerce-platform"],
    productSourceKeys: ["commerce-platform"],
    productGroupIds: [],
    provisioned: true,
    ...overrides
  };
}

function makeIntegrationRepository(): IntegrationRepository {
  return {
    async findSourceByKey(key) {
      if (key !== "commerce-platform") return null;
      return {
        id: "source-1",
        key,
        name: "Commerce Platform",
        enabled: true,
        secretHash: "hash",
        config: {}
      };
    },
    async findSourcesByKeys() { return []; },
    async listProductSources() { return []; },
    async listProductGroups() { return []; },
    async updateSourceCallbackConfig() {},
    async findEventByIdempotencyKey() { return null; },
    async createEvent() { throw new Error("Not used"); },
    async createCallbackAttempt() { throw new Error("Not used"); },
    async markCallbackAttempt() { throw new Error("Not used"); },
    async listFailedCallbackAttempts() { return []; },
    async markSourceSuccess() {},
    async markSourceError() {}
  };
}

function makeProductKnowledgeRepository(overrides: Partial<ProductKnowledgeRepository> = {}): ProductKnowledgeRepository {
  return {
    async createDocument(input) {
      return {
        id: "knowledge-1",
        sourceId: input.sourceId,
        sourceKey: "commerce-platform",
        documentServiceId: input.documentServiceId,
        title: input.title,
        documentType: input.documentType,
        processingStatus: input.processingStatus ?? "pending",
        processingTaskId: input.processingTaskId ?? null,
        processingError: input.processingError ?? null,
        uploadedById: input.uploadedById ?? null,
        createdAt: new Date("2026-08-06T12:00:00.000Z"),
        updatedAt: new Date("2026-08-06T12:00:00.000Z")
      };
    },
    async listDocumentsForSource() { return []; },
    async updateProcessingStatus() { throw new Error("Not used"); },
    async markDeleted() { throw new Error("Not used"); },
    ...overrides
  };
}

describe("product knowledge service", () => {
  it("lets a direct product manager upload text knowledge and stores metadata", async () => {
    const uploadTextProductKnowledge = vi.fn().mockResolvedValue({
      task_id: "task-1",
      document_id: "doc-service-1",
      title: "Checkout FAQ",
      file_size: 100,
      mime_type: "text/plain",
      processing_status: "pending",
      message: "queued"
    });
    const createDocument = vi.fn(makeProductKnowledgeRepository().createDocument);
    const service = createProductKnowledgeService({
      integrations: makeIntegrationRepository(),
      documentService: {
        uploadTextProductKnowledge,
        uploadFileProductKnowledge: vi.fn(),
        searchProductKnowledge: vi.fn(),
        getProcessingStatus: vi.fn(),
        deleteDocument: vi.fn()
      },
      productKnowledge: makeProductKnowledgeRepository({ createDocument })
    });

    await expect(
      service.uploadTextForUser(
        {
          productSourceKey: "commerce-platform",
          title: "Checkout FAQ",
          text: "Checkout troubleshooting steps",
          documentType: "faq"
        },
        makeUser({ roles: ["Product Manager"] })
      )
    ).resolves.toMatchObject({
      documentServiceId: "doc-service-1",
      processingTaskId: "task-1",
      documentType: "faq"
    });

    expect(uploadTextProductKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({
        productSourceKey: "commerce-platform",
        documentType: "faq"
      })
    );
    expect(createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: "source-1",
        documentServiceId: "doc-service-1",
        uploadedById: "user-1"
      })
    );
  });

  it("blocks product users from uploading knowledge", async () => {
    const uploadTextProductKnowledge = vi.fn();
    const service = createProductKnowledgeService({
      integrations: makeIntegrationRepository(),
      documentService: {
        uploadTextProductKnowledge,
        uploadFileProductKnowledge: vi.fn(),
        searchProductKnowledge: vi.fn(),
        getProcessingStatus: vi.fn(),
        deleteDocument: vi.fn()
      },
      productKnowledge: makeProductKnowledgeRepository()
    });

    await expect(
      service.uploadTextForUser(
        {
          productSourceKey: "commerce-platform",
          title: "Checkout FAQ",
          text: "Checkout troubleshooting steps",
          documentType: "faq"
        },
        makeUser({ roles: ["Product User"] })
      )
    ).rejects.toThrow("Current user cannot manage product knowledge");
    expect(uploadTextProductKnowledge).not.toHaveBeenCalled();
  });

  it("lets a direct product manager upload file knowledge and stores metadata", async () => {
    const uploadFileProductKnowledge = vi.fn().mockResolvedValue({
      task_id: "task-file-1",
      document_id: "doc-file-1",
      title: "Checkout Manual",
      file_size: 2048,
      mime_type: "application/pdf",
      processing_status: "pending",
      message: "queued"
    });
    const createDocument = vi.fn(makeProductKnowledgeRepository().createDocument);
    const service = createProductKnowledgeService({
      integrations: makeIntegrationRepository(),
      documentService: {
        uploadTextProductKnowledge: vi.fn(),
        uploadFileProductKnowledge,
        searchProductKnowledge: vi.fn(),
        getProcessingStatus: vi.fn(),
        deleteDocument: vi.fn()
      },
      productKnowledge: makeProductKnowledgeRepository({ createDocument })
    });

    await expect(
      service.uploadFileForUser(
        {
          productSourceKey: "commerce-platform",
          title: "Checkout Manual",
          file: new Blob(["manual"], { type: "application/pdf" }),
          filename: "manual.pdf",
          documentType: "manual"
        },
        makeUser({ roles: ["Product Manager"] })
      )
    ).resolves.toMatchObject({
      documentServiceId: "doc-file-1",
      processingTaskId: "task-file-1",
      documentType: "manual"
    });

    expect(uploadFileProductKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({
        productSourceKey: "commerce-platform",
        filename: "manual.pdf",
        documentType: "manual"
      })
    );
    expect(createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        documentServiceId: "doc-file-1",
        processingTaskId: "task-file-1"
      })
    );
  });

  it("lets product-scoped users search accessible knowledge", async () => {
    const searchProductKnowledge = vi.fn().mockResolvedValue({
      query: "checkout failure",
      results: [],
      total_results: 0
    });
    const service = createProductKnowledgeService({
      integrations: makeIntegrationRepository(),
      documentService: {
        uploadTextProductKnowledge: vi.fn(),
        uploadFileProductKnowledge: vi.fn(),
        searchProductKnowledge,
        getProcessingStatus: vi.fn(),
        deleteDocument: vi.fn()
      },
      productKnowledge: makeProductKnowledgeRepository()
    });

    await service.searchForUser(
      {
        productSourceKey: "commerce-platform",
        query: "checkout failure",
        documentType: "troubleshooting",
        topK: 3
      },
      makeUser({ roles: ["Product User"] })
    );

    expect(searchProductKnowledge).toHaveBeenCalledWith({
      query: "checkout failure",
      productSourceKey: "commerce-platform",
      documentType: "troubleshooting",
      topK: 3
    });
  });

  it("blocks search for unscoped products", async () => {
    const service = createProductKnowledgeService({
      integrations: makeIntegrationRepository(),
      documentService: {
        uploadTextProductKnowledge: vi.fn(),
        uploadFileProductKnowledge: vi.fn(),
        searchProductKnowledge: vi.fn(),
        getProcessingStatus: vi.fn(),
        deleteDocument: vi.fn()
      },
      productKnowledge: makeProductKnowledgeRepository()
    });

    await expect(
      service.searchForUser(
        { productSourceKey: "commerce-platform", query: "checkout failure" },
        makeUser({ productSourceKeys: [], directProductSourceKeys: [] })
      )
    ).rejects.toThrow("Current user cannot search product knowledge");
  });

  it("refreshes processing status using the stored task ID", async () => {
    const getProcessingStatus = vi.fn().mockResolvedValue({
      task_id: "task-1",
      status: "complete",
      stage: "complete",
      progress: 100,
      message: "Indexed",
      timestamp: "2026-08-06T12:00:00.000Z"
    });
    const updateProcessingStatus = vi.fn().mockResolvedValue({
      id: "knowledge-1",
      sourceId: "source-1",
      sourceKey: "commerce-platform",
      documentServiceId: "doc-service-1",
      title: "Checkout FAQ",
      documentType: "faq",
      processingStatus: "completed",
      processingTaskId: "task-1",
      processingError: null,
      uploadedById: "user-1",
      createdAt: new Date("2026-08-06T12:00:00.000Z"),
      updatedAt: new Date("2026-08-06T12:00:00.000Z")
    });
    const service = createProductKnowledgeService({
      integrations: makeIntegrationRepository(),
      documentService: {
        uploadTextProductKnowledge: vi.fn(),
        uploadFileProductKnowledge: vi.fn(),
        searchProductKnowledge: vi.fn(),
        getProcessingStatus,
        deleteDocument: vi.fn()
      },
      productKnowledge: makeProductKnowledgeRepository({ updateProcessingStatus })
    });

    await service.refreshProcessingStatusForUser(
      {
        productSourceKey: "commerce-platform",
        documentServiceId: "doc-service-1",
        processingTaskId: "task-1"
      },
      makeUser({ roles: ["Product Manager"] })
    );

    expect(getProcessingStatus).toHaveBeenCalledWith("task-1");
    expect(updateProcessingStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        documentServiceId: "doc-service-1",
        processingTaskId: "task-1",
        processingStatus: "completed"
      })
    );
  });
});
