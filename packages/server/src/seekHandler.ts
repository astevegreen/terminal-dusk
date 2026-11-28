// The HTTP side of the seek Edge Function (docs/architecture.md, Decision 5, `seek` and Matchmaking; #682): a
// signed-in player starts a public ranked search ("create") or ends one of their own ("cancel"). Plain data in and
// out so it runs under vitest. The player always comes from sign-in, never from the body. The entitlement and the
// limit of 5 are checked by createSeek (matchmake.ts). It does not log.
import type { Side } from "@terminal-dusk/engine";
import type { Platform } from "@terminal-dusk/host";
import { jsonObject, preflight, refusal as refusalReply, reply, signedIn } from "./http.ts";
import type { Authenticate, HttpReply, HttpRequest } from "./http.ts";
import { createSeek } from "./matchmake.ts";
import type { SeekDeps, SeekErrorCode } from "./matchmake.ts";
import type { RankedPreset } from "./rankedPresets.ts";
import type { SeekStore } from "./seekStore.ts";

/** What the handler needs: createSeek's deps, `authenticate` (the caller's player id for a token, or null) and the clock. */
export type SeekHandlerDeps = SeekDeps & { authenticate: Authenticate; now: () => number };

export type SeekHandlerErrorCode =
  SeekErrorCode | "methodNotAllowed" | "illegalAnswer" | "ticketNotFound" | "internalError";

/** The status for each refusal that is not 422 (the invalid checks and hostCreate's own). */
const STATUS: Partial<Record<SeekHandlerErrorCode, number>> = {
  illegalAnswer: 400,
  notSignedIn: 401,
  notEntitled: 403,
  ticketNotFound: 404,
  methodNotAllowed: 405,
  limitReached: 409,
  storageFailed: 500,
  internalError: 500,
};

/** `preset`, `side` and the value of `platform` are checked by createSeek (a bad one is 422 `invalidSeek`). */
type Action =
  { action: "create"; preset: unknown; side: unknown; platform: string } | { action: "cancel"; ticketId: string };

/** Handles one request. It never throws: anything unexpected gives 500 `internalError`. */
export async function handleSeek(deps: SeekHandlerDeps, request: HttpRequest): Promise<HttpReply> {
  try {
    return await handle(deps, request);
  } catch {
    return refusal("internalError", "Something went wrong on the server. Try again.");
  }
}

async function handle(deps: SeekHandlerDeps, request: HttpRequest): Promise<HttpReply> {
  if (request.method === "OPTIONS") return preflight();
  if (request.method !== "POST") return refusal("methodNotAllowed", "Send seek requests with POST.");
  const player = await signedIn(deps.authenticate, request.authorization);
  if (player === null) return refusal("notSignedIn", "Sign in to search for a ranked game.");
  const action = parseBody(request.body);
  if (action === null) {
    return refusal("illegalAnswer", 'The request must be a JSON object with an action ("create" or "cancel").');
  }
  if (action.action === "cancel") return cancel(deps.seeks, action.ticketId, player);
  const made = await createSeek(deps, {
    player,
    platform: action.platform as Platform,
    preset: action.preset as RankedPreset,
    side: action.side as Side | null,
    now: deps.now(),
  });
  if (!made.ok) return refusal(made.error.code, made.error.message ?? "The search was refused.");
  return reply(200, { ok: true, ticketId: made.value.ticketId });
}

async function cancel(seeks: SeekStore, ticketId: string, player: string): Promise<HttpReply> {
  let removed: boolean;
  try {
    removed = await seeks.cancel(ticketId, player);
  } catch {
    return refusal("storageFailed", "The search could not be cancelled. Try again.");
  }
  // A ticket that is gone (already paired) and one that is not theirs get the same reply.
  if (!removed) return refusal("ticketNotFound", "You have no open search with that id.");
  return reply(200, { ok: true });
}

/** The body's action and its fields, or null when it is not a JSON object or has the wrong shape. */
function parseBody(text: string): Action | null {
  const parsed = jsonObject(text);
  if (parsed === null) return null;
  if (parsed.action === "create") {
    if (typeof parsed.platform !== "string") return null;
    return { action: "create", preset: parsed.preset, side: parsed.side ?? null, platform: parsed.platform };
  }
  if (parsed.action === "cancel" && typeof parsed.ticketId === "string" && parsed.ticketId.length > 0) {
    return { action: "cancel", ticketId: parsed.ticketId };
  }
  return null;
}

const refusal = (code: SeekHandlerErrorCode, message: string): HttpReply =>
  refusalReply(STATUS[code] ?? 422, code, message);
