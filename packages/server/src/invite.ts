// Private games (docs/architecture.md, Decision 5): a host creates an invite and shares its code, anyone with
// the code can see how the sides will be assigned, and a second player joins with it, which creates the match.
// Plain TypeScript; the Edge Functions (a later task) wrap it. Nothing here logs codes or seeds.
import { SIDES } from "@terminal-dusk/engine";
import type { Seed, Side } from "@terminal-dusk/engine";
import { hostCreate } from "@terminal-dusk/host";
import type { HostEffect, HostError, PlayerId } from "@terminal-dusk/host";
import { firstDeckConfig, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { inviteCode } from "./inviteCode.ts";
import type { InviteStore, SideMode } from "./inviteStore.ts";
import type { NotifyStore } from "./notifyStore.ts";
import { queueAlerts } from "./queueAlerts.ts";
import type { MatchWrite } from "./store.ts";

/**
 * What the invite functions need: where invites (and the matches they make) live, and the random parts,
 * injected so tests are repeatable: a fresh match id, a fresh seed, the side the host gets in a random
 * invite, and the invite code (defaults to `inviteCode`, a secure random 8-character code). With `notify`,
 * a joined invite queues the new match's turn alerts there.
 */
export type InviteDeps = {
  invites: InviteStore;
  matchId: () => string;
  seed: () => Seed;
  randomHostSide: () => Side;
  code?: () => string;
  notify?: NotifyStore | undefined;
};

export type InviteErrorCode =
  | "invalidInvite"
  | "notSignedIn"
  | "invalidTime"
  | "illegalSide"
  | "inviteNotFound"
  | "ownInvite"
  | "sideRequired"
  | "sideNotChoosable"
  | "storageFailed";
export type InviteError = { code: InviteErrorCode | HostError["code"]; message?: string };
export type InviteOutcome<T> = { ok: true; value: T } | { ok: false; error: InviteError };

export type CreateInviteRequest = { host: PlayerId; sides: SideMode; now: number };
/** `side` is the side the joiner wants; only an "invitee chooses" invite takes one. `undefined` counts as not given. */
export type JoinInviteRequest = { code: string; player: PlayerId; side?: Side | undefined; now: number };
/**
 * The joiner's side, the new match, and `hostCreate`'s effects (so a later task can tell the host the game
 * has started). Adapters do not send the effects to clients.
 */
export type JoinedInvite = { matchId: string; side: Side; effects: HostEffect[] };

/** How many codes `createInvite` tries before giving up, when each one is already taken. */
export const CODE_TRIES = 3;

/** Stores a new, unused invite and returns its code. It never throws and never changes its inputs. */
export async function createInvite(
  deps: InviteDeps,
  request: CreateInviteRequest,
): Promise<InviteOutcome<{ code: string }>> {
  return guarded(async () => {
    const { host, now } = request;
    if (!isPlayer(host)) return refuse("notSignedIn", "Sign in to create an invite.");
    if (!isTime(now)) return refuse("invalidTime", "The time must be a whole number, 0 or more.");
    const sides = sideModeOf(request.sides);
    if (sides === null) return refuse("invalidInvite", "The invite needs a side mode: random, host or invitee.");
    for (let tries = 0; tries < CODE_TRIES; tries++) {
      const code = (deps.code ?? inviteCode)();
      const saved = await deps.invites.save({ code, host, sides, createdAt: now });
      if (saved === "saved") return { ok: true, value: { code } };
    }
    return refuse("storageFailed", "No free invite code was found. Try again.");
  });
}

/** How the sides of an unused invite will be assigned. Never the host's id, a seed or any match data. */
export async function previewInvite(deps: InviteDeps, code: string): Promise<InviteOutcome<{ sides: SideMode }>> {
  return guarded(async () => {
    const found = typeof code === "string" ? await deps.invites.find(code) : null;
    if (found === null || found.accepted !== null) return notFound();
    return { ok: true, value: { sides: sideModeOf(found.sides) ?? found.sides } };
  });
}

/**
 * Joins an unused invite: assigns the sides as its mode says, creates the first-deck match with a fresh id
 * and seed, and stores it while marking the invite used. Checks run in a fixed order and the first that
 * fails is the answer. A refusal stores nothing. It never throws and never changes its inputs.
 */
export async function joinInvite(deps: InviteDeps, request: JoinInviteRequest): Promise<InviteOutcome<JoinedInvite>> {
  return guarded(async () => {
    const { code, player, side, now } = request;
    if (!isPlayer(player)) return refuse("notSignedIn", "Sign in to join a game.");
    if (!isTime(now)) return refuse("invalidTime", "The time must be a whole number, 0 or more.");
    if (side !== undefined && !isSide(side)) return refuse("illegalSide", "The side must be lio or sae.");
    const found = typeof code === "string" ? await deps.invites.find(code) : null;
    if (found === null || found.accepted !== null) return notFound();
    if (found.host === player) return refuse("ownInvite", "You cannot join your own invite.");
    const { sides } = found;
    if (sides.mode === "invitee" && side === undefined) return refuse("sideRequired", "Choose LIO or SAE to join.");
    if (sides.mode !== "invitee" && side !== undefined) {
      return refuse("sideNotChoosable", "This invite does not let the joiner choose a side.");
    }
    const joinerSide = joinerSideFor(deps, sides, side);
    const players = { [joinerSide]: player, [other(joinerSide)]: found.host } as Record<Side, PlayerId>;
    const matchId = deps.matchId();
    const config = { matchId, players, setup: firstDeckConfig().setup };
    const created = hostCreate(firstDeckRuleset, config, deps.seed(), now);
    if (!created.ok) return { ok: false, error: created.error };
    const { effects, ...write } = created.value;
    const accepted = await deps.invites.accept(code, player, write satisfies MatchWrite);
    if (accepted !== "accepted") return notFound();
    await queueAlerts(deps.notify, matchId, write.record.seq, effects, now);
    return { ok: true, value: { matchId, side: joinerSide, effects } };
  });
}

/** The joiner's side. Only called once the side checks have passed. */
function joinerSideFor(deps: InviteDeps, sides: SideMode, side: Side | undefined): Side {
  if (sides.mode === "host") return other(sides.hostSide);
  if (sides.mode === "invitee") return side as Side;
  return other(deps.randomHostSide());
}

/** A copy of `value` when it is exactly one of the three side modes, else null. */
export function sideModeOf(value: unknown): SideMode | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const fields = value as Record<string, unknown>;
  const keys = Object.keys(fields).sort().join(",");
  if ((fields.mode === "random" || fields.mode === "invitee") && keys === "mode") return { mode: fields.mode };
  if (fields.mode === "host" && keys === "hostSide,mode" && isSide(fields.hostSide)) {
    return { mode: "host", hostSide: fields.hostSide };
  }
  return null;
}

const other = (side: Side): Side => (side === "lio" ? "sae" : "lio");
const isSide = (value: unknown): value is Side => SIDES.includes(value as Side);
const isPlayer = (value: unknown): value is PlayerId => typeof value === "string" && value.length > 0;
const isTime = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

const refuse = (code: InviteErrorCode, message: string): { ok: false; error: InviteError } => ({
  ok: false,
  error: { code, message },
});
const notFound = () => refuse("inviteNotFound", "There is no open invite with that code.");

/**
 * Runs one invite call. A throw or rejection anywhere (the store, or an injected generator) becomes
 * `storageFailed`, with none of the thrown text, so the functions never throw.
 */
async function guarded<T>(call: () => Promise<InviteOutcome<T>>): Promise<InviteOutcome<T>> {
  try {
    return await call();
  } catch {
    return refuse("storageFailed", "The invite could not be read or saved.");
  }
}
