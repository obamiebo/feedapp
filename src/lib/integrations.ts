import crypto from "node:crypto";

export const integrationSourceHeader = "x-feedback-source";
export const integrationSecretHeader = "x-feedback-secret";
export const integrationSignatureHeader = "x-feedback-signature";

export function verifyWebhookSignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;

  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (signature.length !== expected.length) return false;

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function signWebhookPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function buildIdempotencyKey(sourceSystem: string, externalId: string): string {
  return `${sourceSystem}:${externalId}`;
}

export function hashIntegrationSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export function timingSafeEqualText(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}
