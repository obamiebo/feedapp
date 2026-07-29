-- Track the user an approval request is routed to separately from the user who finally decides it.
ALTER TABLE "Approval" ADD COLUMN "requestedReviewerId" TEXT;

CREATE INDEX "Approval_requestedReviewerId_idx" ON "Approval"("requestedReviewerId");

ALTER TABLE "Approval" ADD CONSTRAINT "Approval_requestedReviewerId_fkey" FOREIGN KEY ("requestedReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
