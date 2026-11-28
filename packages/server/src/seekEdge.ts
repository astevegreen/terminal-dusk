// The glue between the runtime's fetch-style requests and `handleSeek`, kept here, not in the Deno entry, so it is tested.
import { serveFetch } from "./edge.ts";
import type { FetchRequest, MakeResponse } from "./edge.ts";
import { handleSeek } from "./seekHandler.ts";
import type { SeekHandlerDeps } from "./seekHandler.ts";

/** A fetch-style handler around `handleSeek`. An unreadable body counts as an empty one (a 400 for POST). */
export function seekFetchHandler<R>(
  deps: SeekHandlerDeps,
  respond: MakeResponse<R>,
): (request: FetchRequest) => Promise<R> {
  return serveFetch((request) => handleSeek(deps, request), respond);
}
