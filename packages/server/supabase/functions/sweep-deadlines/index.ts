// The `sweep-deadlines` Edge Function (docs/architecture.md, Decision 5, "Scheduled jobs"): the scheduled job
// calls it every minute to apply every passed deadline. Only wiring lives here; every decision is in
// src/sweepEdge.ts and src/sweepDeadlines.ts, which are tested. A call must present the service role key.
// The Supabase runtime provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; none are in the repository.
// It does not log (.claude/rules/server.md).
import { createClient } from "@supabase/supabase-js";
import type { Ruleset } from "@terminal-dusk/engine";
import { firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import type { FetchRequest, MakeResponse } from "../../../src/edge.ts";
import { sweepDeadlinesFetchHandler } from "../../../src/sweepEdge.ts";
import { SupabaseStore } from "../../../src/supabaseStore.ts";

// The server's tsconfig has no Deno or DOM types, so the few runtime globals used are described here.
type DenoRuntime = {
  env: { get(name: string): string | undefined };
  serve(handler: (request: FetchRequest) => Promise<unknown>): unknown;
};
type ResponseClass = new (...args: Parameters<MakeResponse<unknown>>) => unknown;
const runtime = globalThis as unknown as { Deno: DenoRuntime; Response: ResponseClass };

/** The rulesets this server runs: the same list as `submit` (Decision 5, "Ruleset compatibility window"). */
const RULESETS: Ruleset[] = [firstDeckRuleset];

const required = (name: string): string => {
  const value = runtime.Deno.env.get(name);
  if (!value) throw new Error(`The ${name} environment variable is not set.`);
  return value;
};

const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
const db = createClient(required("SUPABASE_URL"), serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

runtime.Deno.serve(
  sweepDeadlinesFetchHandler(
    {
      store: new SupabaseStore(db),
      rulesetFor: (id) => RULESETS.find((ruleset) => ruleset.id === id) ?? null,
      serviceKey,
      now: () => Date.now(),
    },
    (body, init) => new runtime.Response(body, init),
  ),
);
