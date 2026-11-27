// Reads what the signed-in player owns (#686): their own rows of the `entitlement` table, over the lobby's one
// request-and-result rule. The server's row security lets a player read only their own rows; the filter here asks
// for them by name. A reply that is not a list of entitlements is a refusal, never "owns nothing".
import { isEntitlement } from "@terminal-dusk/host";
import type { Entitlement } from "@terminal-dusk/host";
import { getTable, outcome } from "../online/lobbyHttp.ts";
import type { LobbyEndpoint, LobbyResult } from "../online/lobbyHttp.ts";

/** The rows with only their platform and source, or null when the body is not a list of entitlements. */
function rows(body: unknown): Entitlement[] | null {
  if (!Array.isArray(body) || !body.every(isEntitlement)) return null;
  return body.map(({ platform, source }) => ({ platform, source }));
}

/** `player`'s entitlements, asked for with their access token. */
export async function readEntitlements(
  e: LobbyEndpoint,
  token: string,
  player: string,
): Promise<LobbyResult<Entitlement[]>> {
  const query = ["select=platform,source", `player=eq.${encodeURIComponent(player)}`];
  return outcome(await getTable(e, token, "entitlement", query), rows);
}
