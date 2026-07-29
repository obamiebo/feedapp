CREATE TABLE "IntegrationCallbackAttempt" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "responseStatus" INTEGER,
    "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationCallbackAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IntegrationCallbackAttempt_sourceId_idx" ON "IntegrationCallbackAttempt"("sourceId");
CREATE INDEX "IntegrationCallbackAttempt_caseId_idx" ON "IntegrationCallbackAttempt"("caseId");
CREATE INDEX "IntegrationCallbackAttempt_status_lastAttemptAt_idx" ON "IntegrationCallbackAttempt"("status", "lastAttemptAt");

ALTER TABLE "IntegrationCallbackAttempt" ADD CONSTRAINT "IntegrationCallbackAttempt_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "IntegrationSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationCallbackAttempt" ADD CONSTRAINT "IntegrationCallbackAttempt_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
