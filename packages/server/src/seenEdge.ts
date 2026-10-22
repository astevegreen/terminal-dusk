// The glue between the runtime's fetch-style requests and `handleSeen`, kept here, not in the Deno entry, so
// it is tested.
import { serveFetch } from "./edge.ts";
import type { FetchRequest, MakeResponse } from "./edge.ts";
import { handleSeen } from "./seenHandler.ts";
import type { SeenHandlerDeps } from "./seenHandler.ts";

/** A fetch-style handler around `handleSeen`. An unreadable body counts as an empty one (a 400 for POST). */
export function seenFetchHandler<R>(
  deps: SeenHandlerDeps,
  respond: MakeResponse<R>,
): (request: FetchRequest) => Promise<R> {
  return serveFetch((request) => handleSeen(deps, request), respond);
}
