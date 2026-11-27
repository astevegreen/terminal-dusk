// Paddle's checkout webhook (docs/architecture.md, Decision 5, "Accounts and purchases"): Paddle, the merchant of
// record for web purchases, calls the paddle-webhook Edge Function when an order is paid or refunded. A signed
// "paid" message for the full game gives the buyer one `web` entitlement under the transaction's id; an approved
// full refund removes it. The buyer is the `player_id` the app puts in the order's custom data, and an order with
// no known player is recorded for a person to settle, never guessed. Plain data in and out, so it runs under
// vitest. Replies and log lines never carry the secret, the signature, a player id or the message.
//
// Paddle delivers at least once and in no set order, and retries anything but a 200: so a 200 means "dealt with",
// and a 500 means "send it again".
import type { EntitlementReceipts, UnmatchedReason } from "./entitlementReceipts.ts";
import { isPlainObject, jsonObject, refusal, reply } from "./http.ts";
import type { HttpReply } from "./http.ts";
import { paddleSignatureMatches } from "./paddleSignature.ts";

/** One webhook call: the method, the raw body and the `Paddle-Signature` header (null when missing). */
export type PaddleRequest = { method: string; body: string; signature: string | null };

/** What the handler needs. An unset `secret` refuses every call; `productId` is the full game's Paddle product. */
export type PaddleWebhookDeps = {
  secret: string | undefined;
  productId: string | undefined;
  receipts: EntitlementReceipts;
  /** Whether an account with this id exists. It throws when that can't be found out. */
  playerExists: (id: string) => Promise<boolean>;
  log: (line: string) => void;
};

const SOURCE = "paddle";
const COPY = { platform: "web", source: SOURCE } as const;
/** Both say the money arrived; either may come alone, or first. */
const PAID_EVENTS = new Set(["transaction.paid", "transaction.completed"]);
const REFUND_EVENTS = new Set(["adjustment.created", "adjustment.updated"]);
const PLAYER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Data = Record<string, unknown>;

/** Handles one webhook call. It never throws: anything unexpected gives a 500, so Paddle sends it again. */
export async function handlePaddleWebhook(deps: PaddleWebhookDeps, request: PaddleRequest): Promise<HttpReply> {
  try {
    return await handle(deps, request);
  } catch {
    deps.log("paddle-webhook: failed unexpectedly");
    return refusal(500, "internalError", "The message could not be dealt with. Send it again.");
  }
}

async function handle(deps: PaddleWebhookDeps, request: PaddleRequest): Promise<HttpReply> {
  if (request.method !== "POST") return refused(deps, 405, "methodNotAllowed", "Send Paddle messages with POST.");
  if (!(await paddleSignatureMatches(deps.secret ?? "", request.signature, request.body))) {
    return refused(deps, 401, "badSignature", "The Paddle signature is missing or wrong.");
  }
  const message = jsonObject(request.body);
  const type = message?.event_type;
  if (typeof type !== "string") return malformed(deps);
  if (!PAID_EVENTS.has(type) && !REFUND_EVENTS.has(type)) return done("ignored");
  const data = message?.data;
  if (!isPlainObject(data)) return malformed(deps);
  return PAID_EVENTS.has(type) ? paidOrder(deps, data) : adjustment(deps, data);
}

async function paidOrder(deps: PaddleWebhookDeps, data: Data): Promise<HttpReply> {
  const transaction = text(data.id);
  if (transaction === undefined) return malformed(deps);
  if (deps.productId === undefined) {
    return refused(deps, 500, "notConfigured", "The product is not configured yet. Send the message again.");
  }
  if (!sells(data.items, deps.productId)) return done("ignored");
  const buyer = await buyerOf(deps, data.custom_data);
  if ("reason" in buyer) {
    await deps.receipts.recordUnmatched(SOURCE, transaction, buyer.reason);
    deps.log(`paddle-webhook: unmatched purchase ${transaction} (${buyer.reason})`);
    return done("unmatched");
  }
  const outcome = await deps.receipts.grantReceipt(buyer.player, COPY, transaction);
  deps.log(`paddle-webhook: purchase ${transaction} ${outcome}`);
  return done(outcome);
}

/** Only an approved refund of everything bought takes the game away; every other adjustment changes nothing. */
async function adjustment(deps: PaddleWebhookDeps, data: Data): Promise<HttpReply> {
  if (data.action !== "refund" || data.status !== "approved" || !isFullRefund(data)) return done("ignored");
  const transaction = text(data.transaction_id);
  if (transaction === undefined) return malformed(deps);
  const outcome = await deps.receipts.revokeReceipt(SOURCE, transaction);
  deps.log(`paddle-webhook: refund of ${transaction} ${outcome}`);
  return done(outcome);
}

/** Paddle calls a refund `partial` when it lists items, even when every one of them is refunded in full. */
function isFullRefund({ type, items }: Data): boolean {
  if (type === "full") return true;
  return Array.isArray(items) && items.length > 0 && items.every((i) => isPlainObject(i) && i.type === "full");
}

/** Whether one of the order's items is priced for `productId`. */
const sells = (items: unknown, productId: string): boolean =>
  Array.isArray(items) &&
  items.some((item) => isPlainObject(item) && isPlainObject(item.price) && item.price.product_id === productId);

/** The account the order's custom data names, or why there is none. */
async function buyerOf(
  deps: PaddleWebhookDeps,
  customData: unknown,
): Promise<{ player: string } | { reason: UnmatchedReason }> {
  const id = isPlainObject(customData) ? customData.player_id : undefined;
  if (id === undefined || id === null || id === "") return { reason: "noPlayerId" };
  if (typeof id !== "string" || !PLAYER_ID.test(id)) return { reason: "badPlayerId" };
  return (await deps.playerExists(id)) ? { player: id } : { reason: "unknownPlayer" };
}

const text = (value: unknown): string | undefined => (typeof value === "string" && value !== "" ? value : undefined);

const done = (outcome: string): HttpReply => reply(200, { ok: true, outcome });

function refused(deps: PaddleWebhookDeps, status: number, code: string, message: string): HttpReply {
  deps.log(`paddle-webhook: refused (${code})`);
  return refusal(status, code, message);
}

const malformed = (deps: PaddleWebhookDeps): HttpReply =>
  refused(deps, 400, "badRequest", "The body is not a Paddle message this function can read.");
