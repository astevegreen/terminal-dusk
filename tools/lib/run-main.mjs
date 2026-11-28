// Shared by the tests of the command-line tools that take their world as arguments (env, fetch, now, out, err).

export const KEY = "service-role-key-that-must-not-leak";
export const URL = "http://127.0.0.1:44321";
export const ENV = { SUPABASE_URL: URL, SUPABASE_SERVICE_ROLE_KEY: KEY };

/** Runs a tool's `main` against a fake store and keeps what it printed. */
export async function runMain(main, argv, { env = ENV, store, now = () => 1_700_000_000_000 }) {
  const out = [];
  const err = [];
  const exit = await main(argv, {
    env,
    fetch: store.fetch,
    now,
    out: (line) => out.push(line),
    err: (line) => err.push(line),
  });
  return { exit, out, err, store };
}
