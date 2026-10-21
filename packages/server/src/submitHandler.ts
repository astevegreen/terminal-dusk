// The HTTP side of the submit Edge Function (docs/architecture.md, Decision 5), as plain data in and out so
// it runs under vitest: it signs the caller in, checks the request's shape, calls `submit`, and turns the
// outcome into a JSON reply. Every decision is made here; the Deno entry only wires it to the runtime.
import { isPlainObject, jsonObject, preflight, refusal as refusalReply, reply, signedIn } from "./http.ts";
import type { Authenticate, HttpReply, HttpRequest } from "./http.ts";
import { submit } from "./submit.ts";
import type { SubmitDeps, SubmitError } from "./submit.ts";

export { CORS_HEADERS } from "./http.ts";
export type { HttpReply, HttpRequest } from "./http.ts";

/**
 * What the handler needs: `submit`'s store and ruleset lookup, `authenticate` (the caller's player id for
 * a token, or null), the clock, and an optional logger that only ever gets match ids, seqs and error codes.
 */
export type SubmitHandlerDeps = SubmitDeps & {
  authenticate: Authenticate;
  now: () => number;
  log?: (line: string) => void;
};

export type HandlerErrorCode = SubmitError["code"] | "notSignedIn" | "methodNotAllowed" | "internalError";

/** The status for each refusal that is not 422 (every other refusal from the host or engine). */
const STATUS: Partial<Record<HandlerErrorCode, number>> = {
  notSignedIn: 401,
  notPlayer: 403,
  matchNotFound: 404,
  methodNotAllowed: 405,
  staleSeq: 409,
  unknownRuleset: 409,
  storageFailed: 500,
  internalError: 500,
};

/** Handles one request. It never throws: anything unexpected gives 500 `internalError`. */
export async function handleSubmit(deps: SubmitHandlerDeps, request: HttpRequest): Promise<HttpReply> {
  try {
    return await handle(deps, request);
  } catch {
    log(deps, "submit error=internalError");
    return refusal("internalError", "Something went wrong on the server. Try again.");
  }
}

async function handle(deps: SubmitHandlerDeps, request: HttpRequest): Promise<HttpReply> {
  if (request.method === "OPTIONS") return preflight();
  if (request.method !== "POST") return refused(deps, "methodNotAllowed", "Send answers with POST.");
  const player = await signedIn(deps.authenticate, request.authorization);
  if (player === null) return refused(deps, "notSignedIn", "Sign in to play.");
  const parsed = parseBody(request.body);
  if (parsed === null) {
    return refused(deps, "illegalAnswer", "The request must be JSON with a matchId and a submission object.", 400);
  }
  const { matchId, submission } = parsed;
  const outcome = await submit(deps, { matchId, player, body: submission, now: deps.now() });
  if (!outcome.ok)
    return refused(deps, outcome.error.code, outcome.error.message ?? "The answer was refused.", undefined, matchId);
  const { seq } = outcome.value;
  log(deps, `submit match=${JSON.stringify(matchId)} seq=${seq}`);
  return reply(200, { ok: true, seq });
}

/** The body's match id and submission, or null when it is not JSON or has the wrong shape. */
function parseBody(text: string): { matchId: string; submission: Record<string, unknown> } | null {
  const parsed = jsonObject(text);
  if (parsed === null) return null;
  const { matchId, submission } = parsed;
  if (typeof matchId !== "string" || matchId.length === 0 || !isPlainObject(submission)) return null;
  return { matchId, submission };
}

/** A refusal, logged with its code (and the match id when there is one) and nothing else. */
function refused(
  deps: SubmitHandlerDeps,
  code: HandlerErrorCode,
  message: string,
  status?: number,
  matchId?: string,
): HttpReply {
  log(deps, matchId === undefined ? `submit error=${code}` : `submit match=${JSON.stringify(matchId)} error=${code}`);
  return refusal(code, message, status);
}

const refusal = (code: HandlerErrorCode, message: string, status = STATUS[code] ?? 422): HttpReply =>
  refusalReply(status, code, message);

/** Logging never breaks a reply. */
function log(deps: SubmitHandlerDeps, line: string): void {
  try {
    deps.log?.(line);
  } catch {}
}
