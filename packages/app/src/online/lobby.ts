// The online lobby's invite calls (docs/architecture.md, Decision 5): create a private game, preview an
// invite by its code, and join it, through the invite Edge Function. Every call never throws and returns a
// value or a refusal code (lobbyHttp.ts). Bad inputs and a missing token are refused before any request.
import type { Side } from "@terminal-dusk/engine";
import { isPlatform } from "@terminal-dusk/host";
import type { MatchDeadline, Platform } from "@terminal-dusk/host";
import { isObject, outcome, postFunction, refuse } from "./lobbyHttp.ts";
import type { LobbyEndpoint, LobbyResult } from "./lobbyHttp.ts";

/** Who plays which side, as the invite function takes it (the server's `SideMode`). */
export type SideMode = { mode: "random" } | { mode: "host"; hostSide: Side } | { mode: "invitee" };

/** What the creator picks for a private game. */
export type NewGame = { sides: SideMode; deadline: MatchDeadline; platform: Platform };

/** The joiner's match and the side they play. */
export type Joined = { matchId: string; side: Side };

const isSide = (v: unknown): v is Side => v === "lio" || v === "sae";

/** A fresh copy of a well-formed `SideMode`, or null. */
function sideMode(v: unknown): SideMode | null {
  if (!isObject(v)) return null;
  if (v.mode === "random" || v.mode === "invitee") return { mode: v.mode };
  if (v.mode === "host" && isSide(v.hostSide)) return { mode: "host", hostSide: v.hostSide };
  return null;
}

function deadline(v: unknown): MatchDeadline | null {
  if (!isObject(v)) return null;
  if (v.rule !== "lossOnTime" && v.rule !== "graceThenLoss") return null;
  if (v.days !== 1 && v.days !== 3 && v.days !== 7) return null;
  return { rule: v.rule, days: v.days };
}

/** An invite code as the server stores it: trimmed and upper-cased. */
const normalCode = (code: string): string => (typeof code === "string" ? code.trim().toUpperCase() : "");

/** A 2xx body's fields, when it says `ok: true`. */
const okBody = (body: unknown): Record<string, unknown> | null => (isObject(body) && body.ok === true ? body : null);

/** Creates a private game and returns its invite code. */
export async function createGame(e: LobbyEndpoint, token: string | null, game: NewGame): Promise<LobbyResult<string>> {
  if (token === null) return refuse("notSignedIn");
  const sides = sideMode(game.sides);
  const picked = deadline(game.deadline);
  if (sides === null || picked === null || !isPlatform(game.platform)) return refuse("invalidInvite");
  const reply = await postFunction(e, token, "invite", {
    action: "create",
    sides,
    deadline: picked,
    platform: game.platform,
  });
  return outcome(reply, (body) => {
    const code = okBody(body)?.code;
    return typeof code === "string" && code !== "" ? code : null;
  });
}

/** The sides of the invite with this code. */
export async function previewInvite(
  e: LobbyEndpoint,
  token: string | null,
  code: string,
): Promise<LobbyResult<SideMode>> {
  if (token === null) return refuse("notSignedIn");
  const normal = normalCode(code);
  if (normal === "") return refuse("inviteNotFound");
  const reply = await postFunction(e, token, "invite", { action: "preview", code: normal });
  return outcome(reply, (body) => sideMode(okBody(body)?.sides));
}

/** Joins the invite with this code. `side` is sent only when given (for an invite whose invitee chooses). */
export async function joinGame(
  e: LobbyEndpoint,
  token: string | null,
  code: string,
  side?: Side,
): Promise<LobbyResult<Joined>> {
  if (token === null) return refuse("notSignedIn");
  const normal = normalCode(code);
  if (normal === "") return refuse("inviteNotFound");
  if (side !== undefined && !isSide(side)) return refuse("illegalSide");
  const request = side === undefined ? { action: "join", code: normal } : { action: "join", code: normal, side };
  const reply = await postFunction(e, token, "invite", request);
  return outcome(reply, (body) => {
    const fields = okBody(body);
    if (fields === null || typeof fields.matchId !== "string" || fields.matchId === "") return null;
    return isSide(fields.side) ? { matchId: fields.matchId, side: fields.side } : null;
  });
}
