-- Backfill the original feedback text into the case message stream so existing
-- cases have a conversation history baseline.
INSERT INTO "Message" (
  "id",
  "caseId",
  "channel",
  "direction",
  "body",
  "approvalStatus",
  "deliveryStatus",
  "deliveryAttempts",
  "createdAt"
)
SELECT
  'initial-feedback-' || substr(md5(c."id"), 1, 24),
  c."id",
  CASE
    WHEN customer."phone" IS NOT NULL AND customer."email" IS NULL THEN 'SMS'::"MessageChannel"
    ELSE 'EMAIL'::"MessageChannel"
  END,
  'inbound',
  c."description",
  'APPROVED'::"ApprovalStatus",
  'NOT_REQUIRED'::"MessageDeliveryStatus",
  0,
  c."createdAt"
FROM "Case" c
JOIN "Customer" customer ON customer."id" = c."customerId"
WHERE NOT EXISTS (
  SELECT 1
  FROM "Message" message
  WHERE message."caseId" = c."id"
    AND message."direction" = 'inbound'
);
