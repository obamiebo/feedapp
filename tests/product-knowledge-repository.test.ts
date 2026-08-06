import { describe, expect, it, vi } from "vitest";
import { createPrismaProductKnowledgeRepository } from "@/repositories/product-knowledge";

const now = new Date("2026-08-06T11:30:00.000Z");

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "knowledge-1",
    sourceId: "source-1",
    documentServiceId: "doc-service-1",
    title: "Checkout FAQ",
    documentType: "FAQ",
    processingStatus: "PENDING",
    processingTaskId: "task-1",
    processingError: null,
    uploadedById: "user-1",
    createdAt: now,
    updatedAt: now,
    source: { key: "commerce-platform" },
    ...overrides
  };
}

describe("product knowledge repository", () => {
  it("creates product-scoped document metadata", async () => {
    const create = vi.fn().mockResolvedValue(makeRecord());
    const repository = createPrismaProductKnowledgeRepository({
      productKnowledgeDocument: {
        create,
        findMany: vi.fn(),
        update: vi.fn()
      }
    });

    const record = await repository.createDocument({
      sourceId: "source-1",
      documentServiceId: "doc-service-1",
      title: "Checkout FAQ",
      documentType: "faq",
      processingStatus: "pending",
      processingTaskId: "task-1",
      uploadedById: "user-1"
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceId: "source-1",
          documentServiceId: "doc-service-1",
          documentType: "FAQ",
          processingStatus: "PENDING"
        })
      })
    );
    expect(record).toMatchObject({
      sourceKey: "commerce-platform",
      documentType: "faq",
      processingStatus: "pending"
    });
  });

  it("lists documents for one product source", async () => {
    const findMany = vi.fn().mockResolvedValue([makeRecord({ processingStatus: "COMPLETED" })]);
    const repository = createPrismaProductKnowledgeRepository({
      productKnowledgeDocument: {
        create: vi.fn(),
        findMany,
        update: vi.fn()
      }
    });

    const records = await repository.listDocumentsForSource("source-1");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceId: "source-1" }
      })
    );
    expect(records[0]).toMatchObject({
      processingStatus: "completed"
    });
  });

  it("updates processing status by document-service ID", async () => {
    const update = vi.fn().mockResolvedValue(makeRecord({ processingStatus: "FAILED", processingError: "Indexing failed" }));
    const repository = createPrismaProductKnowledgeRepository({
      productKnowledgeDocument: {
        create: vi.fn(),
        findMany: vi.fn(),
        update
      }
    });

    await expect(
      repository.updateProcessingStatus({
        documentServiceId: "doc-service-1",
        processingStatus: "failed",
        processingError: "Indexing failed"
      })
    ).resolves.toMatchObject({
      processingStatus: "failed",
      processingError: "Indexing failed"
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { documentServiceId: "doc-service-1" },
        data: expect.objectContaining({ processingStatus: "FAILED" })
      })
    );
  });
});
