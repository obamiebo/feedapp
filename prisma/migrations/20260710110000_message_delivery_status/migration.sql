CREATE TYPE "MessageDeliveryStatus" AS ENUM ('NOT_REQUIRED', 'QUEUED', 'SENT', 'FAILED');

ALTER TABLE "Message"
ADD COLUMN "deliveryStatus" "MessageDeliveryStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "deliveryError" TEXT,
ADD COLUMN "lastDeliveryAttemptAt" TIMESTAMP(3);

CREATE INDEX "Message_deliveryStatus_idx" ON "Message"("deliveryStatus");
