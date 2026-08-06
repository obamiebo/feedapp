import type { AppUser } from "@/domain/types";
import type {
  DocumentServiceClient,
  DocumentServiceSearchResponse,
  ProductKnowledgeDocumentType as DocumentServiceDocumentType
} from "@/lib/document-service";
import { createConfiguredDocumentServiceClient } from "@/lib/document-service";
import { canManageProductKnowledge, canSearchProductKnowledge } from "@/lib/access-control";
import type { IntegrationRepository } from "@/repositories/integrations";
import { createPrismaIntegrationRepository } from "@/repositories/integrations";
import type {
  ProductKnowledgeDocumentRecord,
  ProductKnowledgeDocumentType,
  ProductKnowledgeProcessingStatus,
  ProductKnowledgeRepository
} from "@/repositories/product-knowledge";
import { createPrismaProductKnowledgeRepository } from "@/repositories/product-knowledge";

export type ProductKnowledgeService = {
  uploadTextForUser(input: UploadTextProductKnowledgeInput, user: AppUser): Promise<ProductKnowledgeDocumentRecord>;
  uploadFileForUser(input: UploadFileProductKnowledgeInput, user: AppUser): Promise<ProductKnowledgeDocumentRecord>;
  listForUser(productSourceKey: string, user: AppUser): Promise<ProductKnowledgeDocumentRecord[]>;
  searchForUser(input: SearchProductKnowledgeInput, user: AppUser): Promise<DocumentServiceSearchResponse>;
  refreshProcessingStatusForUser(input: RefreshProductKnowledgeStatusInput, user: AppUser): Promise<ProductKnowledgeDocumentRecord>;
  deleteForUser(input: DeleteProductKnowledgeInput, user: AppUser): Promise<ProductKnowledgeDocumentRecord>;
};

export type UploadTextProductKnowledgeInput = {
  productSourceKey: string;
  title: string;
  text: string;
  documentType: ProductKnowledgeDocumentType;
  documentId?: string;
  description?: string;
};

export type UploadFileProductKnowledgeInput = {
  productSourceKey: string;
  title: string;
  file: Blob;
  filename?: string;
  documentType: ProductKnowledgeDocumentType;
  documentId?: string;
  description?: string;
};

export type SearchProductKnowledgeInput = {
  productSourceKey: string;
  query: string;
  documentType?: ProductKnowledgeDocumentType;
  topK?: number;
};

export type DeleteProductKnowledgeInput = {
  productSourceKey: string;
  documentServiceId: string;
};

export type RefreshProductKnowledgeStatusInput = {
  productSourceKey: string;
  documentServiceId: string;
  processingTaskId: string;
};

type ProductKnowledgeServiceDependencies = {
  documentService: Pick<
    DocumentServiceClient,
    | "uploadTextProductKnowledge"
    | "uploadFileProductKnowledge"
    | "searchProductKnowledge"
    | "getProcessingStatus"
    | "deleteDocument"
  >;
  integrations: IntegrationRepository;
  productKnowledge: ProductKnowledgeRepository;
};

export function createProductKnowledgeService(
  dependencies?: Partial<ProductKnowledgeServiceDependencies>
): ProductKnowledgeService {
  let configuredDocumentService: ProductKnowledgeServiceDependencies["documentService"] | null =
    dependencies?.documentService ?? null;
  const integrations = dependencies?.integrations ?? createPrismaIntegrationRepository();
  const productKnowledge = dependencies?.productKnowledge ?? createPrismaProductKnowledgeRepository();

  function getDocumentService() {
    if (!configuredDocumentService) {
      configuredDocumentService = createConfiguredDocumentServiceClient();
    }
    return configuredDocumentService;
  }

  async function resolveSource(sourceKey: string) {
    const source = await integrations.findSourceByKey(sourceKey);
    if (!source || !source.enabled) {
      throw new Error("Product source was not found or is disabled");
    }
    return source;
  }

  return {
    async uploadTextForUser(input, user) {
      const source = await resolveSource(input.productSourceKey);
      if (!canManageProductKnowledge(user, source.key)) {
        throw new Error("Current user cannot manage product knowledge for this source");
      }

      const upload = await getDocumentService().uploadTextProductKnowledge({
        text: input.text,
        productSourceKey: source.key,
        documentType: input.documentType as DocumentServiceDocumentType,
        title: input.title,
        documentId: input.documentId,
        description: input.description
      });

      return productKnowledge.createDocument({
        sourceId: source.id,
        documentServiceId: upload.document_id,
        title: upload.title,
        documentType: input.documentType,
        processingStatus: normalizeProcessingStatus(upload.processing_status),
        processingTaskId: upload.task_id,
        uploadedById: user.id
      });
    },

    async uploadFileForUser(input, user) {
      const source = await resolveSource(input.productSourceKey);
      if (!canManageProductKnowledge(user, source.key)) {
        throw new Error("Current user cannot manage product knowledge for this source");
      }

      const upload = await getDocumentService().uploadFileProductKnowledge({
        file: input.file,
        filename: input.filename,
        productSourceKey: source.key,
        documentType: input.documentType as DocumentServiceDocumentType,
        title: input.title,
        documentId: input.documentId,
        description: input.description
      });

      return productKnowledge.createDocument({
        sourceId: source.id,
        documentServiceId: upload.document_id,
        title: upload.title,
        documentType: input.documentType,
        processingStatus: normalizeProcessingStatus(upload.processing_status),
        processingTaskId: upload.task_id,
        uploadedById: user.id
      });
    },

    async listForUser(productSourceKey, user) {
      const source = await resolveSource(productSourceKey);
      if (!canSearchProductKnowledge(user, source.key)) {
        throw new Error("Current user cannot search product knowledge for this source");
      }

      return productKnowledge.listDocumentsForSource(source.id);
    },

    async searchForUser(input, user) {
      const source = await resolveSource(input.productSourceKey);
      if (!canSearchProductKnowledge(user, source.key)) {
        throw new Error("Current user cannot search product knowledge for this source");
      }

      return getDocumentService().searchProductKnowledge({
        query: input.query,
        productSourceKey: source.key,
        documentType: input.documentType as DocumentServiceDocumentType | undefined,
        topK: input.topK
      });
    },

    async refreshProcessingStatusForUser(input, user) {
      const source = await resolveSource(input.productSourceKey);
      if (!canManageProductKnowledge(user, source.key)) {
        throw new Error("Current user cannot manage product knowledge for this source");
      }

      const status = await getDocumentService().getProcessingStatus(input.processingTaskId);
      return productKnowledge.updateProcessingStatus({
        documentServiceId: input.documentServiceId,
        processingTaskId: input.processingTaskId,
        processingStatus: normalizeProcessingStatus(status.status),
        processingError: status.status === "error" ? status.message : null
      });
    },

    async deleteForUser(input, user) {
      const source = await resolveSource(input.productSourceKey);
      if (!canManageProductKnowledge(user, source.key)) {
        throw new Error("Current user cannot manage product knowledge for this source");
      }

      await getDocumentService().deleteDocument(input.documentServiceId);
      return productKnowledge.markDeleted(input.documentServiceId);
    }
  };
}

function normalizeProcessingStatus(status: string): ProductKnowledgeProcessingStatus {
  const normalized = status.trim().toLowerCase();
  if (normalized === "processing" || normalized === "in_progress") return "processing";
  if (normalized === "completed" || normalized === "complete") return "completed";
  if (normalized === "failed" || normalized === "error") return "failed";
  if (normalized === "deleted") return "deleted";
  return "pending";
}
