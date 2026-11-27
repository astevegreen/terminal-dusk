// The HTTP side of the redeem Edge Function (docs/architecture.md, Decision 5: gift codes are a verified source of
// entitlements; Decision 7: free copies on the web are gift codes), as plain data in and out so it runs under
// vitest. A signed-in player sends a gift code; a good one gives them that code's platform's copy of the game.
// The code itself goes no further than this file: the store gets its hash, and the log gets only the outcome.
import type { PlayerId } from "@terminal-dusk/host";
import { hashGiftCode, normalizeGiftCode } from "./giftCode.ts";
import type { GiftCodeStore, RedeemOutcome } from "./giftCodeStore.ts";
import { jsonObject, preflight, refusal as refusalReply, reply, signedIn } from "./http.ts";
import type { Authenticate, HttpReply, HttpRequest } from "./http.ts";

/**
 * What the handler needs: `authenticate` (the caller's player id for a token, or null), the gift code store, the
 * clock, and an optional logger that only ever gets outcomes and error codes.
 */
export type RedeemHandlerDeps = {
  authenticate: Authenticate;
  codes: GiftCodeStore;
  now: () => number;
  log?: (line: string) => void;
};

export type RedeemErrorCode =
  | "illegalAnswer"
  | "notSignedIn"
  | "unknownCode"
  | "methodNotAllowed"
  | "codeUsed"
  | "alreadyOwned"
  | "tooManyGuesses"
  | "storageFailed"
  | "internalError";

const STATUS: Record<RedeemErrorCode, number> = {
  illegalAnswer: 400,
  notSignedIn: 401,
  unknownCode: 404,
  methodNotAllowed: 405,
  codeUsed: 409,
  alreadyOwned: 409,
  tooManyGuesses: 429,
  storageFailed: 500,
  internalError: 500,
};

/** Each outcome's answer: a success with words, or a refusal code with words. */
const ANSWER: Record<
  RedeemOutcome,
  { ok: true; message: string } | { ok: false; code: RedeemErrorCode; message: string }
> = {
  redeemed: { ok: true, message: "The code worked: the full game is yours." },
  alreadyYours: { ok: true, message: "You have already redeemed this code: the full game is yours." },
  unknown: { ok: false, code: "unknownCode", message: "There is no such code. Check it and try again." },
  used: { ok: false, code: "codeUsed", message: "This code has already been used." },
  owned: {
    ok: false,
    code: "alreadyOwned",
    message: "You already own the full game here. The code is still unused, so you can pass it on.",
  },
  limited: {
    ok: false,
    code: "tooManyGuesses",
    message: "Too many codes that did not work. Try again in an hour.",
  },
};

/** Handles one request. It never throws: anything unexpected gives 500 `internalError`. */
export async function handleRedeem(deps: RedeemHandlerDeps, request: HttpRequest): Promise<HttpReply> {
  try {
    return await handle(deps, request);
  } catch {
    return refused(deps, "internalError", "Something went wrong on the server. Try again.");
  }
}

async function handle(deps: RedeemHandlerDeps, request: HttpRequest): Promise<HttpReply> {
  if (request.method === "OPTIONS") return preflight();
  if (request.method !== "POST") return refused(deps, "methodNotAllowed", "Send redeem requests with POST.");
  const player = await signedIn(deps.authenticate, request.authorization);
  if (player === null) return refused(deps, "notSignedIn", "Sign in to redeem a gift code.");
  const code = parseBody(request.body);
  if (code === null) {
    return refused(deps, "illegalAnswer", "Send a JSON object with the code: 20 letters and numbers.");
  }
  const outcome = await redeem(deps, await hashGiftCode(code), player);
  if (outcome === null) return refused(deps, "storageFailed", "The code could not be redeemed. Try again.");
  const answer = ANSWER[outcome];
  if (!answer.ok) return refused(deps, answer.code, answer.message);
  log(deps, `redeem outcome=${outcome}`);
  return reply(200, { ok: true, status: outcome, message: answer.message });
}

/** The body's code in the stored form, or null when the body has no code that could match one. */
function parseBody(text: string): string | null {
  const parsed = jsonObject(text);
  return parsed !== null && typeof parsed.code === "string" ? normalizeGiftCode(parsed.code) : null;
}

/** The store's outcome, or null when it failed (a throw, a rejection, or no outcome), with none of its text. */
async function redeem(deps: RedeemHandlerDeps, hash: string, player: PlayerId): Promise<RedeemOutcome | null> {
  try {
    const outcome = await deps.codes.redeem(hash, player, deps.now());
    return outcome in ANSWER ? outcome : null;
  } catch {
    return null;
  }
}

/** A refusal, logged with its code and nothing else. */
function refused(deps: RedeemHandlerDeps, code: RedeemErrorCode, message: string): HttpReply {
  log(deps, `redeem error=${code}`);
  return refusalReply(STATUS[code], code, message);
}

/** Logging never breaks a reply. */
function log(deps: RedeemHandlerDeps, line: string): void {
  try {
    deps.log?.(line);
  } catch {}
}
