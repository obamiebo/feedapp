CREATE TABLE "CaseStage" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL,
    "priority" "Priority" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "lastCustomerUpdateAt" TIMESTAMP(3),
    "lastPromptReviewedAt" TIMESTAMP(3),
    "followUpCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CaseStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessagingCadencePolicy" (
    "id" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL,
    "priority" "Priority" NOT NULL,
    "staleAfterHours" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingCadencePolicy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CaseStage_caseId_endedAt_idx" ON "CaseStage"("caseId", "endedAt");
CREATE INDEX "CaseStage_status_priority_endedAt_startedAt_idx" ON "CaseStage"("status", "priority", "endedAt", "startedAt");
CREATE UNIQUE INDEX "MessagingCadencePolicy_status_priority_key" ON "MessagingCadencePolicy"("status", "priority");

ALTER TABLE "CaseStage" ADD CONSTRAINT "CaseStage_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CaseStage" ("id", "caseId", "status", "priority", "startedAt")
SELECT CONCAT('stage-', "id"), "id", "status", "priority", "createdAt"
FROM "Case"
WHERE NOT EXISTS (
  SELECT 1 FROM "CaseStage" WHERE "CaseStage"."caseId" = "Case"."id" AND "CaseStage"."endedAt" IS NULL
);

INSERT INTO "MessagingCadencePolicy" ("id", "status", "priority", "staleAfterHours", "enabled", "updatedAt")
VALUES
  ('cadence-new-critical', 'NEW', 'CRITICAL', 4, true, CURRENT_TIMESTAMP),
  ('cadence-new-high', 'NEW', 'HIGH', 8, true, CURRENT_TIMESTAMP),
  ('cadence-new-medium', 'NEW', 'MEDIUM', 24, true, CURRENT_TIMESTAMP),
  ('cadence-new-low', 'NEW', 'LOW', 48, true, CURRENT_TIMESTAMP),
  ('cadence-assigned-critical', 'ASSIGNED', 'CRITICAL', 24, true, CURRENT_TIMESTAMP),
  ('cadence-assigned-high', 'ASSIGNED', 'HIGH', 48, true, CURRENT_TIMESTAMP),
  ('cadence-assigned-medium', 'ASSIGNED', 'MEDIUM', 72, true, CURRENT_TIMESTAMP),
  ('cadence-assigned-low', 'ASSIGNED', 'LOW', 96, true, CURRENT_TIMESTAMP),
  ('cadence-in-progress-critical', 'IN_PROGRESS', 'CRITICAL', 24, true, CURRENT_TIMESTAMP),
  ('cadence-in-progress-high', 'IN_PROGRESS', 'HIGH', 48, true, CURRENT_TIMESTAMP),
  ('cadence-in-progress-medium', 'IN_PROGRESS', 'MEDIUM', 72, true, CURRENT_TIMESTAMP),
  ('cadence-in-progress-low', 'IN_PROGRESS', 'LOW', 96, true, CURRENT_TIMESTAMP),
  ('cadence-reopened-critical', 'REOPENED', 'CRITICAL', 24, true, CURRENT_TIMESTAMP),
  ('cadence-reopened-high', 'REOPENED', 'HIGH', 48, true, CURRENT_TIMESTAMP),
  ('cadence-reopened-medium', 'REOPENED', 'MEDIUM', 72, true, CURRENT_TIMESTAMP),
  ('cadence-reopened-low', 'REOPENED', 'LOW', 96, true, CURRENT_TIMESTAMP),
  ('cadence-resolved-critical', 'RESOLVED', 'CRITICAL', 72, false, CURRENT_TIMESTAMP),
  ('cadence-resolved-high', 'RESOLVED', 'HIGH', 72, false, CURRENT_TIMESTAMP),
  ('cadence-resolved-medium', 'RESOLVED', 'MEDIUM', 72, false, CURRENT_TIMESTAMP),
  ('cadence-resolved-low', 'RESOLVED', 'LOW', 72, false, CURRENT_TIMESTAMP),
  ('cadence-closed-critical', 'CLOSED', 'CRITICAL', 72, false, CURRENT_TIMESTAMP),
  ('cadence-closed-high', 'CLOSED', 'HIGH', 72, false, CURRENT_TIMESTAMP),
  ('cadence-closed-medium', 'CLOSED', 'MEDIUM', 72, false, CURRENT_TIMESTAMP),
  ('cadence-closed-low', 'CLOSED', 'LOW', 72, false, CURRENT_TIMESTAMP)
ON CONFLICT ("status", "priority") DO NOTHING;
