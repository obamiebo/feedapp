import { prisma } from "@/lib/db";

export type ProductKnowledgeDocumentType = "faq" | "manual" | "troubleshooting" | "release_note" | "policy";
export type ProductKnowledgeProcessingStatus = "pending" | "processing" | "completed" | "failed" | "deleted";

export type ProductKnowledgeDocumentRecord = {
  id: string;
  sourceId: string;
  sourceKey: string;
  documentServiceId: string;
  title: string;
  documentType: ProductKnowledgeDocumentType;
  processingStatus: ProductKnowledgeProcessingStatus;
  processingTaskId: string | null;
  processingError: string | null;
  uploadedById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateProductKnowledgeDocumentRecord = {
  sourceId: string;
  documentServiceId: string;
  title: string;
  documentType: ProductKnowledgeDocumentType;
  processingStatus?: ProductKnowledgeProcessingStatus;
  processingTaskId?: string | null;
  processingError?: string | null;
  uploadedById?: string | null;
};

export type ProductKnowledgeRepository = {
  createDocument(input: CreateProductKnowledgeDocumentRecord): Promise<ProductKnowledgeDocumentRecord>;
  listDocumentsForSource(sourceId: string): Promise<ProductKnowledgeDocumentRecord[]>;
  updateProcessingStatus(input: {
    documentServiceId: string;
    processingStatus: ProductKnowledgeProcessingStatus;
    processingTaskId?: string | null;
    processingError?: string | null;
  }): Promise<ProductKnowledgeDocumentRecord>;
  markDeleted(documentServiceId: string): Promise<ProductKnowledgeDocumentRecord>;
};

type ProductKnowledgeModel = {
  create(args: unknown): Promise<PrismaProductKnowledgeRecord>;
  findMany(args: unknown): Promise<PrismaProductKnowledgeRecord[]>;
  update(args: unknown): Promise<PrismaProductKnowledgeRecord>;
  upsert(args: unknown): Promise<PrismaProductKnowledgeRecord>;
};

type ProductKnowledgeClient = {
  productKnowledgeDocument: ProductKnowledgeModel;
};

type PrismaProductKnowledgeRecord = {
  id: string;
  sourceId: string;
  documentServiceId: string;
  title: string;
  documentType: string;
  processingStatus: string;
  processingTaskId: string | null;
  processingError: string | null;
  uploadedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  source: { key: string };
};

const documentTypeToPrisma: Record<ProductKnowledgeDocumentType, string> = {
  faq: "FAQ",
  manual: "MANUAL",
  troubleshooting: "TROUBLESHOOTING",
  release_note: "RELEASE_NOTE",
  policy: "POLICY"
};

const documentTypeFromPrisma: Record<string, ProductKnowledgeDocumentType> = {
  FAQ: "faq",
  MANUAL: "manual",
  TROUBLESHOOTING: "troubleshooting",
  RELEASE_NOTE: "release_note",
  POLICY: "policy"
};

const statusToPrisma: Record<ProductKnowledgeProcessingStatus, string> = {
  pending: "PENDING",
  processing: "PROCESSING",
  completed: "COMPLETED",
  failed: "FAILED",
  deleted: "DELETED"
};

const statusFromPrisma: Record<string, ProductKnowledgeProcessingStatus> = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  DELETED: "deleted"
};

function toRecord(record: PrismaProductKnowledgeRecord): ProductKnowledgeDocumentRecord {
  return {
    id: record.id,
    sourceId: record.sourceId,
    sourceKey: record.source.key,
    documentServiceId: record.documentServiceId,
    title: record.title,
    documentType: documentTypeFromPrisma[record.documentType] ?? "faq",
    processingStatus: statusFromPrisma[record.processingStatus] ?? "pending",
    processingTaskId: record.processingTaskId,
    processingError: record.processingError,
    uploadedById: record.uploadedById,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

const includeSourceKey = {
  source: { select: { key: true } }
};

export function createPrismaProductKnowledgeRepository(
  client: ProductKnowledgeClient = prisma as unknown as ProductKnowledgeClient
): ProductKnowledgeRepository {
  return {
    async createDocument(input) {
      const data = {
        sourceId: input.sourceId,
        documentServiceId: input.documentServiceId,
        title: input.title,
        documentType: documentTypeToPrisma[input.documentType],
        processingStatus: statusToPrisma[input.processingStatus ?? "pending"],
        processingTaskId: input.processingTaskId ?? null,
        processingError: input.processingError ?? null,
        uploadedById: input.uploadedById ?? null
      };
      const record = await client.productKnowledgeDocument.upsert({
        where: { documentServiceId: input.documentServiceId },
        create: data,
        update: {
          sourceId: input.sourceId,
          title: input.title,
          documentType: documentTypeToPrisma[input.documentType],
          processingStatus: statusToPrisma[input.processingStatus ?? "pending"],
          processingTaskId: input.processingTaskId ?? null,
          processingError: input.processingError ?? null,
          uploadedById: input.uploadedById ?? null
        },
        include: includeSourceKey
      });

      return toRecord(record);
    },

    async listDocumentsForSource(sourceId) {
      const records = await client.productKnowledgeDocument.findMany({
        where: { sourceId },
        include: includeSourceKey,
        orderBy: { createdAt: "desc" }
      });

      return records.map(toRecord);
    },

    async updateProcessingStatus(input) {
      const record = await client.productKnowledgeDocument.update({
        where: { documentServiceId: input.documentServiceId },
        data: {
          processingStatus: statusToPrisma[input.processingStatus],
          processingTaskId: input.processingTaskId,
          processingError: input.processingError
        },
        include: includeSourceKey
      });

      return toRecord(record);
    },

    async markDeleted(documentServiceId) {
      const record = await client.productKnowledgeDocument.update({
        where: { documentServiceId },
        data: {
          processingStatus: "DELETED"
        },
        include: includeSourceKey
      });

      return toRecord(record);
    }
  };
}
