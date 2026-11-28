// The `seek` Edge Function (docs/architecture.md, Decision 5, `seek`; #682): start or cancel a public ranked search.
// Only wiring lives here; every decision is in src/seekHandler.ts and src/matchmake.ts, which are tested.
// The Supabase runtime provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; none are in the repository.
// It does not log (.claude/rules/server.md).
import { createClient } from "@supabase/supabase-js";
import type { FetchRequest, MakeResponse } from "../../../src/edge.ts";
import { seekFunctionDeps } from "../../../src/functionDeps.ts";
import { seekFetchHandler } from "../../../src/seekEdge.ts";

// The server's tsconfig has no Deno or DOM types, so the few runtime globals used are described here.
type DenoRuntime = {
  env: { get(name: string): string | undefined };
  serve(handler: (request: FetchRequest) => Promise<unknown>): unknown;
};
type ResponseClass = new (...args: Parameters<MakeResponse<unknown>>) => unknown;
const runtime = globalThis as unknown as {
  Deno: DenoRuntime;
  Response: ResponseClass;
  crypto: { randomUUID(): string };
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
  seekFetchHandler(
    seekFunctionDeps(db, { now: () => Date.now(), ticketId: () => runtime.crypto.randomUUID() }),
    (body, init) => new runtime.Response(body, init),
  ),
);
