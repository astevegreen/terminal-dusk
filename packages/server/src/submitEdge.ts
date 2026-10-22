// The glue between the runtime's fetch-style requests and `handleSubmit`. The shared parts (the fetch
// request shape and the Supabase sign-in check) live in edge.ts and are re-exported here.
import { serveFetch } from "./edge.ts";
import type { FetchRequest, MakeResponse } from "./edge.ts";
import { handleSubmit } from "./submitHandler.ts";
import type { SubmitHandlerDeps } from "./submitHandler.ts";

export { supabaseAuthenticate } from "./edge.ts";
export type { FetchRequest, MakeResponse } from "./edge.ts";

/** A fetch-style handler around `handleSubmit`. An unreadable body counts as an empty one (a 400 for POST). */
export function fetchHandler<R>(
  deps: SubmitHandlerDeps,
  respond: MakeResponse<R>,
): (request: FetchRequest) => Promise<R> {
  return serveFetch((request) => handleSubmit(deps, request), respond);
}
