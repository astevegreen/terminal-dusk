// The `submit` Edge Function (docs/architecture.md, Decision 5): the one place a client sends an answer or a
// resignation. Only wiring lives here; every decision is in src/submitHandler.ts, which is tested.
// The Supabase runtime provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; none are in the repository.
import { createClient } from "@supabase/supabase-js";
import type { Ruleset } from "@terminal-dusk/engine";
import { firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { fetchHandler, supabaseAuthenticate } from "../../../src/submitEdge.ts";
import type { FetchRequest, MakeResponse } from "../../../src/submitEdge.ts";
import { SupabaseStore } from "../../../src/supabaseStore.ts";

// The server's tsconfig has no Deno or DOM types, so the few runtime globals used are described here.
type DenoRuntime = {
  env: { get(name: string): string | undefined };
  serve(handler: (request: FetchRequest) => Promise<unknown>): unknown;
};
type ResponseClass = new (...args: Parameters<MakeResponse<unknown>>) => unknown;
const runtime = globalThis as unknown as {
  Deno: DenoRuntime;
  Response: ResponseClass;
  console: { log(line: string): void };
};

/** The rulesets this server runs. Before v1 there is one (Decision 5, "Ruleset compatibility window"). */
const RULESETS: Ruleset[] = [firstDeckRuleset];

const required = (name: string): string => {
  const value = runtime.Deno.env.get(name);
  if (!value) throw new Error(`The ${name} environment variable is not set.`);
  return value;
};

const db = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

runtime.Deno.serve(
  fetchHandler(
    {
      store: new SupabaseStore(db),
      ruleset: (id) => RULESETS.find((ruleset) => ruleset.id === id),
      authenticate: supabaseAuthenticate(db),
      now: () => Date.now(),
      log: (line) => runtime.console.log(line),
    },
    (body, init) => new runtime.Response(body, init),
  ),
);
