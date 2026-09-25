import { timingSafeEqual } from "node:crypto";

export function isWebhookSecretValid(expected: string | undefined, provided: string | null): boolean {
  if (!expected || provided === null) return false;
  const suppliedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}
