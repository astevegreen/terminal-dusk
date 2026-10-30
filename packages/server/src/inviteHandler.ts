// The HTTP side of the invite Edge Function (docs/architecture.md, Decision 5), as plain data in and out so it
// runs under vitest, the way submitHandler.ts wraps `submit`. It signs the caller in, checks the body's shape,
// calls O5a's createInvite, previewInvite or joinInvite, and turns the outcome into a JSON reply.
// The host and the joiner are always the signed-in caller, never a body field. It does not log, like `submit`.
import type { Side } from "@terminal-dusk/engine";
import type { PlayerId } from "@terminal-dusk/host";
import { createInvite, joinInvite, previewInvite } from "./invite.ts";
import type { InviteDeps, InviteError, InviteOutcome } from "./invite.ts";
import { CORS_HEADERS, isPlainObject, reply, signedIn } from "./submitHandler.ts";
import type { HttpReply, HttpRequest } from "./submitHandler.ts";

/** What the handler needs: O5a's invite deps, `authenticate` (the caller's player id for a token, or null) and the clock. */
export type InviteHandlerDeps = InviteDeps & {
  authenticate: (token: string) => Promise<PlayerId | null>;
  now: () => number;
};

export type InviteHandlerErrorCode =
  InviteError["code"] | "illegalAnswer" | "notSignedIn" | "methodNotAllowed" | "internalError";

/** A well-formed request body. */
type InviteRequest =
  | { action: "create"; sides: unknown }
  | { action: "preview"; code: string }
  | { action: "join"; code: string; side: Side | undefined };

/**
 * The status for each refusal that is not 422. Every other refusal (invalidInvite, invalidTime, sideRequired,
 * sideNotChoosable and each refusal from hostCreate) is 422.
 */
const STATUS: Partial<Record<InviteHandlerErrorCode, number>> = {
  illegalAnswer: 400,
  notSignedIn: 401,
  inviteNotFound: 404,
  methodNotAllowed: 405,
  ownInvite: 409,
  storageFailed: 500,
  internalError: 500,
};

/** Handles one request. It never throws: anything unexpected gives 500 `internalError`. */
export async function handleInvite(deps: InviteHandlerDeps, request: HttpRequest): Promise<HttpReply> {
  try {
    return await handle(deps, request);
  } catch {
    return refusal("internalError", "Something went wrong on the server. Try again.");
  }
}

async function handle(deps: InviteHandlerDeps, request: HttpRequest): Promise<HttpReply> {
  if (request.method === "OPTIONS") return { status: 204, headers: { ...CORS_HEADERS }, body: "" };
  if (request.method !== "POST") return refusal("methodNotAllowed", "Send invite requests with POST.");
  const player = await signedIn(deps, request.authorization);
  if (player === null) return refusal("notSignedIn", "Sign in to create or join a game.");
  const parsed = parseBody(request.body);
  if (parsed === null) {
    return refusal(
      "illegalAnswer",
      'The request must be a JSON object with an action ("create", "preview" or "join") and its fields.',
    );
  }
  switch (parsed.action) {
    case "create": {
      const outcome = await createInvite(deps, { host: player, sides: parsed.sides as never, now: deps.now() });
      return answer(outcome, ({ code }) => ({ code }));
    }
    case "preview":
      return answer(await previewInvite(deps, parsed.code), ({ sides }) => ({ sides }));
    case "join": {
      const { code, side } = parsed;
      const outcome = await joinInvite(deps, { code, player, side, now: deps.now() });
      // Only the match id and the joiner's side: O5a's effects stay on the server.
      return answer(outcome, ({ matchId, side: joined }) => ({ matchId, side: joined }));
    }
  }
}

/** The body as a well-formed request, or null: not JSON, not an object, an unknown action, or a bad field. */
function parseBody(text: string): InviteRequest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isPlainObject(parsed)) return null;
  const { action, code, side } = parsed;
  if (action === "create") return { action, sides: parsed.sides };
  if (action !== "preview" && action !== "join") return null;
  if (typeof code !== "string" || code.length === 0) return null;
  if (action === "preview") return { action, code };
  if ("side" in parsed && side !== "lio" && side !== "sae") return null;
  return { action, code, side: side as Side | undefined };
}

/** A 200 with `ok: true` and the fields `pick` takes from the value, or the refusal. */
function answer<T>(outcome: InviteOutcome<T>, pick: (value: T) => Record<string, unknown>): HttpReply {
  if (!outcome.ok) return refusal(outcome.error.code, outcome.error.message ?? "The request was refused.");
  return reply(200, { ok: true, ...pick(outcome.value) });
}

const refusal = (code: InviteHandlerErrorCode, message: string): HttpReply =>
  reply(STATUS[code] ?? 422, { ok: false, error: { code, message } });
