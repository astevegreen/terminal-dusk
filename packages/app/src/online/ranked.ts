// The ranked search calls (docs/architecture.md, Decision 5, `seek`; #682): start and cancel a search through the
// seek Edge Function, and read the player's own open searches (their `seek` rows, which row-level security shows
// only to them). Like lobby.ts, nothing here throws: each call gives a value or a refusal code (lobbyHttp.ts).
import type { Side } from "@terminal-dusk/engine";
import { isPlatform } from "@terminal-dusk/host";
import type { Platform } from "@terminal-dusk/host";
import { getTable, isObject, outcome, postFunction, refuse } from "./lobbyHttp.ts";
import type { LobbyEndpoint, LobbyResult } from "./lobbyHttp.ts";

/** The deadline presets by NAME. The hours behind them are the server's placeholder (rankedPresets.ts), not shown here. */
export const RANKED_PRESETS = ["fast", "normal", "slow"] as const;
export type RankedPreset = (typeof RANKED_PRESETS)[number];

/** What the player asks for: a preset and a side, or null for no preference. */
export type RankedSearch = { preset: RankedPreset; side: Side | null; platform: Platform };

/** One of the player's open searches. */
export type OpenSearch = { id: string; preset: RankedPreset; side: Side | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isRankedPreset = (v: unknown): v is RankedPreset => RANKED_PRESETS.includes(v as RankedPreset);

/** Starts a search and returns its ticket id. */
export async function startSearch(
  e: LobbyEndpoint,
  token: string | null,
  search: RankedSearch,
): Promise<LobbyResult<string>> {
  if (token === null) return refuse("notSignedIn");
  if (!isRankedPreset(search.preset) || !isPlatform(search.platform)) return refuse("invalidSeek");
  if (search.side !== null && search.side !== "lio" && search.side !== "sae") return refuse("invalidSeek");
  const reply = await postFunction(e, token, "seek", {
    action: "create",
    preset: search.preset,
    side: search.side,
    platform: search.platform,
  });
  return outcome(reply, (body) => {
    const id = isObject(body) && body.ok === true ? body.ticketId : undefined;
    return typeof id === "string" && id !== "" ? id : null;
  });
}

/** Ends one of the player's own searches. */
export async function cancelSearch(
  e: LobbyEndpoint,
  token: string | null,
  ticketId: string,
): Promise<LobbyResult<true>> {
  if (token === null) return refuse("notSignedIn");
  if (typeof ticketId !== "string" || ticketId === "") return refuse("ticketNotFound");
  const reply = await postFunction(e, token, "seek", { action: "cancel", ticketId });
  return outcome(reply, (body) => (isObject(body) && body.ok === true ? true : null));
}

function openSearch(row: unknown): OpenSearch | null {
  if (!isObject(row)) return null;
  const { id, preset, side } = row;
  if (typeof id !== "string" || id === "" || !isRankedPreset(preset)) return null;
  if (side !== null && side !== "lio" && side !== "sae") return null;
  return { id, preset, side };
}

/** The player's open searches, oldest first. One malformed row fails the whole call as `network`. */
export async function openSearches(
  e: LobbyEndpoint,
  token: string | null,
  playerId: string,
): Promise<LobbyResult<OpenSearch[]>> {
  if (token === null) return refuse("notSignedIn");
  // The id goes into the filter, so anything but a UUID is refused before a request.
  if (typeof playerId !== "string" || !UUID.test(playerId)) return refuse("notSignedIn");
  const reply = await getTable(e, token, "seek", [
    "select=id,preset,side",
    `player=eq.${playerId}`,
    "order=created_at.asc",
  ]);
  return outcome(reply, (body) => {
    if (!Array.isArray(body)) return null;
    const list: OpenSearch[] = [];
    for (const row of body) {
      const search = openSearch(row);
      if (search === null) return null;
      list.push(search);
    }
    return list;
  });
}
