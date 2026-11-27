// The `redeem` Edge Function (docs/architecture.md, Decision 7, "Free copies"): a signed-in player turns a gift
// code into a copy of the game. Only wiring lives here; every decision is in src/redeemHandler.ts,
// src/redeemEdge.ts and src/functionDeps.ts, which are tested.
// The Supabase runtime provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; none are in the repository.
// It logs outcomes and error codes only: never a code, a hash, a token or a player id (.claude/rules/server.md).
import { createClient } from "@supabase/supabase-js";
import type { FetchRequest, MakeResponse } from "../../../src/edge.ts";
import { redeemFunctionDeps } from "../../../src/functionDeps.ts";
import { redeemFetchHandler } from "../../../src/redeemEdge.ts";

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

const required = (name: string): string => {
  const value = runtime.Deno.env.get(name);
  if (!value) throw new Error(`The ${name} environment variable is not set.`);
  return value;
};

const db = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

runtime.Deno.serve(
  redeemFetchHandler(
    redeemFunctionDeps(db, { now: () => Date.now(), log: (line) => runtime.console.log(line) }),
    (body, init) => new runtime.Response(body, init),
  ),
);
