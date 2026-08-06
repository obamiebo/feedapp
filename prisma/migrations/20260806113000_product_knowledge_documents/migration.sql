CREATE TYPE "ProductKnowledgeDocumentType" AS ENUM (
  'FAQ',
  'MANUAL',
  'TROUBLESHOOTING',
  'RELEASE_NOTE',
  'POLICY'
);

CREATE TYPE "ProductKnowledgeProcessingStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'DELETED'
);

CREATE TABLE "ProductKnowledgeDocument" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "documentServiceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "documentType" "ProductKnowledgeDocumentType" NOT NULL,
  "processingStatus" "ProductKnowledgeProcessingStatus" NOT NULL DEFAULT 'PENDING',
  "processingTaskId" TEXT,
  "processingError" TEXT,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductKnowledgeDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductKnowledgeDocument_documentServiceId_key" ON "ProductKnowledgeDocument"("documentServiceId");
CREATE INDEX "ProductKnowledgeDocument_sourceId_documentType_idx" ON "ProductKnowledgeDocument"("sourceId", "documentType");
CREATE INDEX "ProductKnowledgeDocument_sourceId_processingStatus_idx" ON "ProductKnowledgeDocument"("sourceId", "processingStatus");
CREATE INDEX "ProductKnowledgeDocument_uploadedById_idx" ON "ProductKnowledgeDocument"("uploadedById");

ALTER TABLE "ProductKnowledgeDocument"
  ADD CONSTRAINT "ProductKnowledgeDocument_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "IntegrationSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductKnowledgeDocument"
  ADD CONSTRAINT "ProductKnowledgeDocument_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
