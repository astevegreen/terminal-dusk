// The HTTP side of the seen Edge Function (docs/architecture.md, Decision 5, Notifications: "Email only if the
// turn is still unseen after about 20 minutes"), as plain data in and out so it runs under vitest. A signed-in
// player's app says it has shown them the match at `seq`; the handler marks that player's queued turn alert
// seen and writes nothing else, so `submit` stays the one write path for games (CLAUDE.md, hard rule 7).
import type { PlayerId } from "@terminal-dusk/host";
import { CORS_HEADERS, jsonObject, preflight, refusal as refusalReply, signedIn } from "./http.ts";
import type { Authenticate, HttpReply, HttpRequest } from "./http.ts";
import type { NotifyStore } from "./notifyStore.ts";
import type { MatchStore } from "./store.ts";

/**
 * What the handler needs: `authenticate` (the caller's player id for a token, or null), the match store (only
 * read), the turn alert queue, and an optional logger that only ever gets match ids, seqs and error codes.
 */
export type SeenHandlerDeps = {
  authenticate: Authenticate;
  store: MatchStore;
  notify: NotifyStore;
  log?: (line: string) => void;
};

export type SeenErrorCode =
  "illegalAnswer" | "notSignedIn" | "matchNotFound" | "methodNotAllowed" | "storageFailed" | "internalError";

const STATUS: Record<SeenErrorCode, number> = {
  illegalAnswer: 400,
  notSignedIn: 401,
  matchNotFound: 404,
  methodNotAllowed: 405,
  storageFailed: 500,
  internalError: 500,
};

const STORAGE_FAILED = "The turn could not be marked seen. Try again.";

/** Handles one request. It never throws: anything unexpected gives 500 `internalError`. */
export async function handleSeen(deps: SeenHandlerDeps, request: HttpRequest): Promise<HttpReply> {
  try {
    return await handle(deps, request);
  } catch {
    return refused(deps, "internalError", "Something went wrong on the server. Try again.");
  }
}

async function handle(deps: SeenHandlerDeps, request: HttpRequest): Promise<HttpReply> {
  if (request.method === "OPTIONS") return preflight();
  if (request.method !== "POST") return refused(deps, "methodNotAllowed", "Send seen requests with POST.");
  const player = await signedIn(deps.authenticate, request.authorization);
  if (player === null) return refused(deps, "notSignedIn", "Sign in to mark a turn seen.");
  const parsed = parseBody(request.body);
  if (parsed === null) {
    return refused(deps, "illegalAnswer", "The request must be a JSON object with a matchId and a whole-number seq.");
  }
  const { matchId } = parsed;
  const loaded = await attempt(() => deps.store.load(matchId));
  if (!loaded.ok) return refused(deps, "storageFailed", STORAGE_FAILED, matchId);
  // An unknown match and a match the caller does not play get the same reply, so a stranger learns nothing.
  const record = loaded.value?.record;
  if (!record || !isPlayer(record.players, player)) {
    return refused(deps, "matchNotFound", "There is no such match.", matchId);
  }
  // A player cannot mark a turn seen before the match has reached it.
  const seq = Math.min(parsed.seq, record.seq);
  const marked = await attempt(() => deps.notify.seen(matchId, player, seq));
  if (!marked.ok) return refused(deps, "storageFailed", STORAGE_FAILED, matchId);
  log(deps, `seen match=${JSON.stringify(matchId)} seq=${seq}`);
  return { status: 204, headers: { ...CORS_HEADERS }, body: "" };
}

/** The body's match id and seq, or null when it is not a JSON object, or the seq is not a whole number 0 or more. */
function parseBody(text: string): { matchId: string; seq: number } | null {
  const parsed = jsonObject(text);
  if (parsed === null) return null;
  const { matchId, seq } = parsed;
  if (typeof matchId !== "string" || matchId.length === 0) return null;
  if (typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 0) return null;
  return { matchId, seq };
}

const isPlayer = (players: Record<string, PlayerId>, player: PlayerId): boolean =>
  Object.values(players).includes(player);

/** Runs one storage call. A throw or a rejection becomes a failure, with none of the thrown text. */
async function attempt<T>(call: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await call() };
  } catch {
    return { ok: false };
  }
}

/** A refusal, logged with its code (and the match id when there is one) and nothing else. */
function refused(deps: SeenHandlerDeps, code: SeenErrorCode, message: string, matchId?: string): HttpReply {
  log(deps, matchId === undefined ? `seen error=${code}` : `seen match=${JSON.stringify(matchId)} error=${code}`);
  return refusalReply(STATUS[code], code, message);
}

/** Logging never breaks a reply. */
function log(deps: SeenHandlerDeps, line: string): void {
  try {
    deps.log?.(line);
  } catch {}
}
