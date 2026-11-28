// The `matchmake` Edge Function (docs/architecture.md, Decision 5, "Scheduled jobs", Matchmaking; #681): the scheduled
// job calls it every minute to pair open ranked tickets. Only wiring lives here; every decision is in src/matchmake.ts
// and src/sweepEdge.ts, which are tested. A call must present the service role key.
// The Supabase runtime provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; none are in the repository.
// It does not log (.claude/rules/server.md).
import { createClient } from "@supabase/supabase-js";
import type { FetchRequest, MakeResponse } from "../../../src/edge.ts";
import { secureInviteRandom } from "../../../src/inviteEdge.ts";
import { SupabaseEntitlementStore } from "../../../src/supabaseEntitlementStore.ts";
import { SupabaseNotifyStore } from "../../../src/supabaseNotifyStore.ts";
import { SupabaseSeekStore } from "../../../src/supabaseSeekStore.ts";
import { matchmakeFetchHandler } from "../../../src/sweepEdge.ts";

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

const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
const db = createClient(required("SUPABASE_URL"), serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const { matchId, seed } = secureInviteRandom();

runtime.Deno.serve(
  matchmakeFetchHandler(
    {
      matchmake: {
        seeks: new SupabaseSeekStore(db),
        entitlements: new SupabaseEntitlementStore(db),
        notify: new SupabaseNotifyStore(db),
        matchId,
        seed,
      },
      serviceKey,
      now: () => Date.now(),
    },
    (body, init) => new runtime.Response(body, init),
  ),
);
