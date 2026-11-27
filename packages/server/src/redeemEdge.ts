// The glue between the runtime's fetch-style requests and `handleRedeem`, kept here, not in the Deno entry, so
// it is tested.
import { serveFetch } from "./edge.ts";
import type { FetchRequest, MakeResponse } from "./edge.ts";
import { handleRedeem } from "./redeemHandler.ts";
import type { RedeemHandlerDeps } from "./redeemHandler.ts";

/** A fetch-style handler around `handleRedeem`. An unreadable body counts as an empty one (a 400 for POST). */
export function redeemFetchHandler<R>(
  deps: RedeemHandlerDeps,
  respond: MakeResponse<R>,
): (request: FetchRequest) => Promise<R> {
  return serveFetch((request) => handleRedeem(deps, request), respond);
}
