// The HTTP side of the invite Edge Function (docs/architecture.md, Decision 5), as plain data in and out so it
// runs under vitest, the same way the submit handler does: it signs the caller in, checks the body's shape,
// calls O5a's createInvite, previewInvite or joinInvite, and turns the outcome into a JSON reply. The host and
// joiner always come from sign-in, never from the body. It does not log.
import type { Side } from "@terminal-dusk/engine";
import { jsonObject, preflight, refusal as refusalReply, reply, signedIn } from "./http.ts";
import type { Authenticate, HttpReply, HttpRequest } from "./http.ts";
import { createInvite, joinInvite, previewInvite } from "./invite.ts";
import type { InviteDeps, InviteError, InviteOutcome } from "./invite.ts";
import type { SideMode } from "./inviteStore.ts";

/** What the handler needs: O5a's invite deps, `authenticate` (the caller's player id for a token, or null) and the clock. */
export type InviteHandlerDeps = InviteDeps & { authenticate: Authenticate; now: () => number };

export type InviteHandlerErrorCode =
  InviteError["code"] | "notSignedIn" | "methodNotAllowed" | "illegalAnswer" | "internalError";

/** The status for each refusal that is not 422 (invalidInvite, invalidTime, the side checks and hostCreate's own). */
const STATUS: Partial<Record<InviteHandlerErrorCode, number>> = {
  illegalAnswer: 400,
  notSignedIn: 401,
  inviteNotFound: 404,
  methodNotAllowed: 405,
  ownInvite: 409,
  storageFailed: 500,
  internalError: 500,
};

/** One well-formed request body. `sides` is checked by createInvite (a bad one is 422 `invalidInvite`). */
type Action =
  | { action: "create"; sides: unknown }
  | { action: "preview"; code: string }
  | { action: "join"; code: string; side: Side | undefined };

/** Handles one request. It never throws: anything unexpected gives 500 `internalError`. */
export async function handleInvite(deps: InviteHandlerDeps, request: HttpRequest): Promise<HttpReply> {
  try {
    return await handle(deps, request);
  } catch {
    return refusal("internalError", "Something went wrong on the server. Try again.");
  }
}

async function handle(deps: InviteHandlerDeps, request: HttpRequest): Promise<HttpReply> {
  if (request.method === "OPTIONS") return preflight();
  if (request.method !== "POST") return refusal("methodNotAllowed", "Send invite requests with POST.");
  const player = await signedIn(deps.authenticate, request.authorization);
  if (player === null) return refusal("notSignedIn", "Sign in to create or join a game.");
  const action = parseBody(request.body);
  if (action === null) {
    return refusal(
      "illegalAnswer",
      'The request must be a JSON object with an action ("create", "preview" or "join") and its fields.',
    );
  }
  switch (action.action) {
    case "create": {
      const sides = action.sides as SideMode;
      return answer(await createInvite(deps, { host: player, sides, now: deps.now() }), ({ code }) => ({ code }));
    }
    case "preview":
      return answer(await previewInvite(deps, action.code), ({ sides }) => ({ sides }));
    case "join": {
      const joined = await joinInvite(deps, { code: action.code, player, side: action.side, now: deps.now() });
      // hostCreate's effects stay on the server; the joiner learns only the match and their side.
      return answer(joined, ({ matchId, side }) => ({ matchId, side }));
    }
  }
}

/** The body's action and its fields, or null when it is not a JSON object or has the wrong shape. */
function parseBody(text: string): Action | null {
  const parsed = jsonObject(text);
  if (parsed === null) return null;
  const { action, code, side } = parsed;
  if (action === "create") return { action, sides: parsed.sides };
  if (typeof code !== "string" || code.length === 0) return null;
  if (action === "preview") return { action, code };
  if (action !== "join") return null;
  if ("side" in parsed && side !== "lio" && side !== "sae") return null;
  return { action, code, side: side as Side | undefined };
}

/** A 200 with `{ ok: true, ...pick(value) }`, or the refusal for the outcome's error. */
function answer<T>(outcome: InviteOutcome<T>, pick: (value: T) => Record<string, unknown>): HttpReply {
  if (!outcome.ok) return refusal(outcome.error.code, outcome.error.message ?? "The invite request was refused.");
  return reply(200, { ok: true, ...pick(outcome.value) });
}

const refusal = (code: InviteHandlerErrorCode, message: string): HttpReply =>
  refusalReply(STATUS[code] ?? 422, code, message);
