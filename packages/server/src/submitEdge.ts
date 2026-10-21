// The glue between the runtime's fetch-style requests and `handleSubmit`, and the Supabase sign-in check.
// Kept here, not in the Deno entry, so it is tested; the server's tsconfig has no DOM types, so the request
// and response are described by the few members used.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerId } from "@terminal-dusk/host";
import { handleSubmit } from "./submitHandler.ts";
import type { SubmitHandlerDeps } from "./submitHandler.ts";

/** The parts of a fetch `Request` the function reads. */
export type FetchRequest = { method: string; headers: { get(name: string): string | null }; text(): Promise<string> };
/** Makes the runtime's `Response`. A null body is required for 204. */
export type MakeResponse<R> = (body: string | null, init: { status: number; headers: Record<string, string> }) => R;

/** A fetch-style handler around `handleSubmit`. An unreadable body counts as an empty one (a 400 for POST). */
export function fetchHandler<R>(
  deps: SubmitHandlerDeps,
  respond: MakeResponse<R>,
): (request: FetchRequest) => Promise<R> {
  return async (request) => {
    let body = "";
    let authorization: string | null = null;
    try {
      authorization = request.headers.get("authorization");
      body = await request.text();
    } catch {}
    const reply = await handleSubmit(deps, { method: request.method, authorization, body });
    return respond(reply.status === 204 ? null : reply.body, { status: reply.status, headers: reply.headers });
  };
}

/** Signs a caller in by their access token with a service-role client: their user id, or null. */
export const supabaseAuthenticate =
  (db: SupabaseClient) =>
  async (token: string): Promise<PlayerId | null> => {
    const { data, error } = await db.auth.getUser(token);
    return error || !data.user ? null : data.user.id;
  };
