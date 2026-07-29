-- Store the intended outbound channel for customer reply approval requests.
ALTER TABLE "Approval" ADD COLUMN "channel" "MessageChannel" NOT NULL DEFAULT 'EMAIL';
