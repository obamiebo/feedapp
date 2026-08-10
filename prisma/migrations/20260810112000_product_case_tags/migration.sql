-- Product-scoped tags for segmenting cases by source/product.
CREATE TABLE "CaseTag" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#244f89',
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseTagAssignment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseTagAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaseTag_sourceId_name_key" ON "CaseTag"("sourceId", "name");
CREATE INDEX "CaseTag_sourceId_active_idx" ON "CaseTag"("sourceId", "active");
CREATE INDEX "CaseTag_createdById_idx" ON "CaseTag"("createdById");
CREATE UNIQUE INDEX "CaseTagAssignment_caseId_tagId_key" ON "CaseTagAssignment"("caseId", "tagId");
CREATE INDEX "CaseTagAssignment_tagId_idx" ON "CaseTagAssignment"("tagId");
CREATE INDEX "CaseTagAssignment_assignedById_idx" ON "CaseTagAssignment"("assignedById");

ALTER TABLE "CaseTag" ADD CONSTRAINT "CaseTag_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "IntegrationSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseTagAssignment" ADD CONSTRAINT "CaseTagAssignment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseTagAssignment" ADD CONSTRAINT "CaseTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "CaseTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
