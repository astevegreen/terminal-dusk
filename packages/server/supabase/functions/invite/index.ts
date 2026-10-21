// The `invite` Edge Function (docs/architecture.md, Decision 5): create, preview and join a private game. Only
// wiring lives here; every decision is in src/inviteHandler.ts and src/inviteEdge.ts, which are tested.
// The Supabase runtime provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; none are in the repository.
// It does not log (.claude/rules/server.md).
import { createClient } from "@supabase/supabase-js";
import { supabaseAuthenticate } from "../../../src/edge.ts";
import type { FetchRequest, MakeResponse } from "../../../src/edge.ts";
import { inviteFetchHandler, secureInviteRandom } from "../../../src/inviteEdge.ts";
import { SupabaseInviteStore } from "../../../src/supabaseInviteStore.ts";

// The server's tsconfig has no Deno or DOM types, so the few runtime globals used are described here.
type DenoRuntime = {
  env: { get(name: string): string | undefined };
  serve(handler: (request: FetchRequest) => Promise<unknown>): unknown;
};
type ResponseClass = new (...args: Parameters<MakeResponse<unknown>>) => unknown;
const runtime = globalThis as unknown as { Deno: DenoRuntime; Response: ResponseClass };

const required = (name: string): string => {
  const value = runtime.Deno.env.get(name);
  if (!value) throw new Error(`The ${name} environment variable is not set.`);
  return value;
};

const db = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

runtime.Deno.serve(
  inviteFetchHandler(
    {
      invites: new SupabaseInviteStore(db),
      ...secureInviteRandom(),
      authenticate: supabaseAuthenticate(db),
      now: () => Date.now(),
    },
    (body, init) => new runtime.Response(body, init),
  ),
);
