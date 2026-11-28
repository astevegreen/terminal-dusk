// Public ranked matchmaking (docs/architecture.md, Decision 5; #681). `createSeek` stores a player's ticket after the
// entitlement and the limit of 5 are checked. `matchmake` is the sweep that runs every minute: it pairs compatible
// tickets, widening the rating band the longer a ticket waits, creates a ranked loss-on-time match for each pair and
// removes both tickets. Running it twice pairs once, because a paired ticket is gone.
// Plain TypeScript; nothing here logs a player, a seed or a ticket.
import { SIDES, seedHash } from "@terminal-dusk/engine";
import type { Seed, Side } from "@terminal-dusk/engine";
import { hostCreate, joinRankedRefusal, isPlatform, START_RATING } from "@terminal-dusk/host";
import type { HostError, Platform, PlayerId } from "@terminal-dusk/host";
import { firstDeckConfig, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import type { EntitlementStore } from "./entitlementStore.ts";
import type { NotifyStore } from "./notifyStore.ts";
import { queueAlerts } from "./queueAlerts.ts";
import { PLACEHOLDER_PRESET_DEADLINE, isRankedPreset } from "./rankedPresets.ts";
import type { RankedPreset } from "./rankedPresets.ts";
import { byAge } from "./seekStore.ts";
import type { SeekStore, SeekTicket } from "./seekStore.ts";
import type { MatchStore, MatchWrite } from "./store.ts";

/** Owner-approved (27 Nov 2026): at most 5 ranked games running at once per player, open tickets counted. */
export const RANKED_LIMIT = 5;
/** The rating band's half-width at minute 0, and how much it widens each whole minute waited (architect, #681). */
export const BAND_START = 100;
export const BAND_PER_MINUTE = 50;
/** From this many whole minutes waited the band is "anyone". */
export const ANYONE_AFTER_MINUTES = 20;
const MINUTE_MS = 60_000;

/** A ticket's rating band half-width after waiting from `createdAt` to `now`; `Infinity` once it takes anyone. */
export function bandFor(createdAt: number, now: number): number {
  const minutes = Math.max(0, Math.floor((now - createdAt) / MINUTE_MS));
  return minutes >= ANYONE_AFTER_MINUTES ? Infinity : BAND_START + BAND_PER_MINUTE * minutes;
}

/** Two tickets are compatible: different players, the same preset, and a rating gap within the wider band. */
export function compatible(a: SeekTicket, b: SeekTicket, now: number): boolean {
  if (a.player === b.player || a.preset !== b.preset) return false;
  return Math.abs(a.rating - b.rating) <= Math.max(bandFor(a.createdAt, now), bandFor(b.createdAt, now));
}

/**
 * The pairs, each as [earlier ticket, later ticket]. Tickets are taken oldest first (then by id); each takes the
 * compatible unpaired ticket with the smallest rating gap, ties to the older. Pure.
 */
export function pairUp(tickets: readonly SeekTicket[], now: number): [SeekTicket, SeekTicket][] {
  const sorted = [...tickets].sort(byAge);
  const used = new Set<string>();
  const pairs: [SeekTicket, SeekTicket][] = [];
  for (const first of sorted) {
    if (used.has(first.id)) continue;
    let best: SeekTicket | null = null;
    for (const other of sorted) {
      if (other === first || used.has(other.id) || !compatible(first, other, now)) continue;
      if (best === null || Math.abs(first.rating - other.rating) < Math.abs(first.rating - best.rating)) best = other;
    }
    if (best === null) continue;
    used.add(first.id).add(best.id);
    pairs.push(byAge(first, best) <= 0 ? [first, best] : [best, first]);
  }
  return pairs;
}

/**
 * The side the earlier ticket plays when the sides are not decided by a preference: the low bit of the first digit of
 * the match seed's public hash. The same seed always gives the same split.
 */
export function seededFirstSide(seed: Seed): Side {
  return (Number.parseInt(seedHash(seed).charAt(0), 16) & 1) === 0 ? "lio" : "sae";
}

const other = (side: Side): Side => (side === "lio" ? "sae" : "lio");

/** The earlier ticket's side. Different preferences are honoured, a single preference is honoured, else the seed decides. */
export function firstSideFor(first: SeekTicket, second: SeekTicket, seed: Seed): Side {
  if (first.side !== null && first.side !== second.side) return first.side;
  if (second.side !== null && second.side !== first.side) return other(second.side);
  return seededFirstSide(seed);
}

export type SeekErrorCode =
  "notSignedIn" | "invalidTime" | "invalidSeek" | "limitReached" | "storageFailed" | HostError["code"];
export type SeekError = { code: SeekErrorCode; message?: string };
export type SeekOutcome = { ok: true; value: { ticketId: string } } | { ok: false; error: SeekError };

/** What `createSeek` needs. `matches` is read only for the player's rating. */
export type SeekDeps = {
  seeks: SeekStore;
  entitlements: EntitlementStore;
  matches: Pick<MatchStore, "ratings">;
  ticketId: () => string;
};

export type CreateSeekRequest = {
  player: PlayerId;
  platform: Platform;
  preset: RankedPreset;
  /** The side wanted, or null / undefined for no preference. */
  side?: Side | null | undefined;
  now: number;
};

const refuse = (code: SeekErrorCode, message: string): SeekOutcome => ({ ok: false, error: { code, message } });

/**
 * Stores a ticket. Checks run in order: signed in, time, preset, side, platform, the entitlement for that platform
 * (`joinRankedRefusal`), then the limit of 5, which the store checks in the same step as it saves. A refusal stores
 * nothing. It never throws.
 */
export async function createSeek(deps: SeekDeps, request: CreateSeekRequest): Promise<SeekOutcome> {
  try {
    const { player, platform, preset, now } = request;
    const side = request.side ?? null;
    if (typeof player !== "string" || player.length === 0) return refuse("notSignedIn", "Sign in to search.");
    if (!Number.isInteger(now) || now < 0) return refuse("invalidTime", "The time must be a whole number, 0 or more.");
    if (!isRankedPreset(preset)) return refuse("invalidSeek", "The preset must be fast, normal or slow.");
    if (side !== null && !SIDES.includes(side)) return refuse("invalidSeek", "The side must be lio or sae.");
    if (!isPlatform(platform)) return refuse("invalidSeek", "The platform must be web, steam, ios or android.");
    const refused = joinRankedRefusal(await deps.entitlements.forPlayer(player), platform);
    if (refused?.code === "notEntitled") return { ok: false, error: refused };
    if (refused !== null) return refuse("storageFailed", "The player's entitlements could not be read.");
    const [row] = await deps.matches.ratings([player]);
    const rating = Math.round(row?.rating ?? START_RATING.rating);
    const ticketId = deps.ticketId();
    const saved = await deps.seeks.create({ id: ticketId, player, rating, preset, side, createdAt: now }, RANKED_LIMIT);
    if (saved === "limit") return refuse("limitReached", `You can have at most ${RANKED_LIMIT} ranked games running.`);
    return { ok: true, value: { ticketId } };
  } catch {
    return refuse("storageFailed", "The search could not be saved.");
  }
}

/** What the sweep needs: the ticket store, the random parts (injected so tests repeat), and the notify queue. */
export type MatchmakeDeps = {
  seeks: SeekStore;
  matchId: () => string;
  seed: () => Seed;
  notify: NotifyStore | undefined;
};

export const MATCHMAKE_STATUSES = ["paired", "unavailable", "failed"] as const;
export type MatchmakeResult = { status: "paired"; matchId: string } | { status: "unavailable" | "failed" };

/**
 * Pairs every compatible pair of open tickets at `now` and creates their matches. One pair's failure never stops the
 * others, and the sweep never throws. A match is ranked, uses loss on time and the preset's deadline, and both
 * players are queued their turn alert.
 */
export async function matchmake(deps: MatchmakeDeps, now: number): Promise<MatchmakeResult[]> {
  let tickets: SeekTicket[];
  try {
    tickets = await deps.seeks.open();
  } catch {
    return [];
  }
  const results: MatchmakeResult[] = [];
  for (const [first, second] of pairUp(tickets, now)) results.push(await pairOne(deps, first, second, now));
  return results;
}

async function pairOne(
  deps: MatchmakeDeps,
  first: SeekTicket,
  second: SeekTicket,
  now: number,
): Promise<MatchmakeResult> {
  try {
    const seed = deps.seed();
    const firstSide = firstSideFor(first, second, seed);
    const players = { [firstSide]: first.player, [other(firstSide)]: second.player } as Record<Side, PlayerId>;
    const matchId = deps.matchId();
    const config = {
      matchId,
      players,
      setup: firstDeckConfig().setup,
      deadline: PLACEHOLDER_PRESET_DEADLINE[first.preset],
    };
    const created = hostCreate(firstDeckRuleset, config, seed, now);
    if (!created.ok) return { status: "failed" };
    const { effects, ...rest } = created.value;
    const write: MatchWrite = { ...rest, record: { ...rest.record, ranked: true } };
    const paired = await deps.seeks.pair([first.id, second.id], write);
    if (paired !== "paired") return { status: "unavailable" };
    await queueAlerts(deps.notify, matchId, write.record.seq, effects, now);
    return { status: "paired", matchId };
  } catch {
    return { status: "failed" };
  }
}
