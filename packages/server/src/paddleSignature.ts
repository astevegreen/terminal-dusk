// Paddle Billing's webhook signature (https://developer.paddle.com/webhooks): the `Paddle-Signature` header is
// `ts=<unix seconds>;h1=<hex>`, where `h1` is HMAC-SHA256 over `<ts>:<raw body>` with the endpoint's secret text
// as the key. While a secret is rotated several `h1` values are sent. Nothing here logs, and a bad input answers
// false rather than throwing.
//
// The timestamp's age is deliberately not checked. A message delivered again does no harm, because one receipt
// gets one entitlement and a refunded receipt gets none (EntitlementReceipts); refusing old messages would instead
// lose a purchase whose delivery Paddle had to retry.
import { hmacSha256, sameText, utf8 } from "./webhookSignature.ts";

const TIMESTAMP = /^ts=([0-9]{1,15})$/;
const SIGNATURE = /^h1=([0-9a-f]{64})$/;

/** The hex signature Paddle sends for `body` at `timestamp` (unix seconds) under `secret`. */
export async function paddleSignature(secret: string, timestamp: string, body: string): Promise<string> {
  const mac = await hmacSha256(utf8(secret), `${timestamp}:${body}`);
  return Array.from(mac, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Whether one of the header's `h1` signatures matches the raw `body` under `secret`. Never throws. */
export async function paddleSignatureMatches(secret: string, header: string | null, body: string): Promise<boolean> {
  if (secret.length === 0 || header === null) return false;
  const parts = header.split(";");
  const timestamps = parts.filter((part) => part.startsWith("ts="));
  const timestamp = timestamps.length === 1 ? TIMESTAMP.exec(timestamps[0] ?? "")?.[1] : undefined;
  const offered = parts.flatMap((part) => SIGNATURE.exec(part)?.[1] ?? []);
  if (timestamp === undefined || offered.length === 0) return false;
  try {
    const expected = await paddleSignature(secret, timestamp, body);
    let found = false;
    // Every offered signature is compared, so the time taken does not depend on which one matched.
    for (const candidate of offered) found = sameText(candidate, expected) || found;
    return found;
  } catch {
    return false;
  }
}
