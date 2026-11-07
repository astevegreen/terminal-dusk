// Connects the migration test to the local Supabase stack (docs/sprint.md, lane "online": no hosted project).
// Keys and the URL come from environment variables at test time, never from the repository.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const HOW_TO_START =
  "Start the local Supabase stack (Docker must be running): in packages/server first give the sign-in email " +
  "hook a local test secret, which `supabase start` reads (any random value, never a real one): " +
  '`export SEND_EMAIL_HOOK_SECRET="v1,whsec_$(openssl rand -base64 32)"`, then run ' +
  '`pnpm exec supabase start`, then `eval "$(pnpm exec supabase status -o env)"`, then `pnpm test:migrations`, ' +
  "which empties the local database, applies every migration (`supabase db reset`) and runs these checks. " +
  "It waits its turn if another folder is using the stack (tools/stack-lock.mjs). " +
  "To have sign-in codes land in the stack's mail catcher (Mailpit, web page http://127.0.0.1:44324), give the " +
  "served functions a git-ignored env file, packages/server/supabase/functions/.env (`supabase functions serve` " +
  "reads it, or pass `--env-file <file>`), with two lines: `LOCAL_MAIL_URL=http://host.docker.internal:44324` and " +
  "`SEND_EMAIL_HOOK_SECRET=<the same value you exported for supabase start>`. The secret goes in that file too " +
  "because the Edge Function runs in its own container, which reads only that file, not your shell. Also " +
  "`export` the same SEND_EMAIL_HOOK_SECRET in the shell that runs `pnpm test:stack`, so the catcher test can " +
  "sign its call. Never use a real address or secret, and nothing hosted reads that file.";
// Why the test itself doesn't apply the migration: that needs a direct Postgres connection or a child process,
// both Node APIs this package's tsconfig doesn't have (no Node types). The test:migrations script does it instead.

type Env = Record<string, string | undefined>;
// The server's tsconfig has no Node types, so process is read through globalThis.
const env: Env = (globalThis as { process?: { env: Env } }).process?.env ?? {};
const first = (e: Env, ...names: string[]) => names.map((n) => e[n]).find((v) => v !== undefined && v !== "");

export type StackKeys = { url: string; anonKey: string; serviceKey: string };

/** The local stack's URL and keys, accepting the names `supabase status -o env` prints. */
export function stackKeys(e: Env = env): StackKeys | null {
  const url = first(e, "SUPABASE_URL", "API_URL");
  const anonKey = first(e, "SUPABASE_ANON_KEY", "ANON_KEY", "PUBLISHABLE_KEY");
  const serviceKey = first(e, "SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY", "SECRET_KEY");
  return url && anonKey && serviceKey ? { url, anonKey, serviceKey } : null;
}

/**
 * Whether the stack checks must run: in CI with the stack's URL and keys set (CI's stack job sets them; its jobs
 * without a stack don't). There a stack or served function that does not answer fails instead of passing quietly.
 */
export function stackRequired(e: Env = env): boolean {
  const ci = e.CI;
  return ci !== undefined && ci !== "" && ci !== "false" && ci !== "0" && stackKeys(e) !== null;
}

/**
 * The one test a stack test file has when its checks can't run: it fails when they are `required`, else it warns
 * why they did not run and how to start the stack.
 */
export function didNotRun(
  title: string,
  why: string | null,
  required: boolean = stackRequired(),
  warn: (line: string) => void = (line) => (globalThis as { console?: { warn(m: string): void } }).console?.warn(line),
): void {
  if (required) throw new Error(`${title} must run in CI, where the stack's keys are set, but ${why}.`);
  warn(
    `${title}: checks did not run: ${why}. ${HOW_TO_START} ` +
      "With the stack up, `pnpm test:stack` in packages/server runs these checks too, holding the stack so " +
      "another folder's `pnpm test:migrations` can't empty the database under them.",
  );
}

export const client = (url: string, key: string): SupabaseClient =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

/**
 * Why the stack can't be used, or null when it answers. A network failure comes back with an empty error code;
 * any database answer (even "table missing") means the stack is up, so the tests run and report it.
 */
export async function whyUnavailable(keys: StackKeys | null): Promise<string | null> {
  if (!keys) return "no local Supabase keys in the environment";
  const down = `the local Supabase stack at ${keys.url} did not answer`;
  try {
    const { error } = await client(keys.url, keys.serviceKey).from("match").select("match_id").limit(1);
    return error && error.code === "" ? down : null;
  } catch {
    return down;
  }
}

/** A fresh id for this run, so two runs against the same stack never collide. */
export const freshId = (): string =>
  (globalThis as unknown as { crypto: { randomUUID(): string } }).crypto.randomUUID();
