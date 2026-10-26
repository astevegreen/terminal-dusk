// The phase 4 rehearsal's link to the local Supabase stack (docs/sprint.md, lane "online": no hosted project).
// The URL and keys come from environment variables at test time, never from the repository. Everything goes
// through plain fetch: the auth admin and sign-in endpoints for test users, the invite function to make each
// match as two players would, and service-role reads for what the server holds. Clients never use the service
// role; only these checks do.
import type { Side, Viewer } from "@terminal-dusk/engine";
import type { Frame, MatchSecret } from "@terminal-dusk/host";
import type { ServerSnapshot } from "./rehearsal.ts";

export const HOW_TO_START =
  "Start the local Supabase stack and serve its functions as packages/server's stack tests explain " +
  "(`pnpm exec supabase start`, then `pnpm exec supabase functions serve` in a second terminal, then " +
  '`eval "$(pnpm exec supabase status -o env)"`), then run `pnpm test:stack` in packages/app, which waits its ' +
  "turn for the stack (tools/stack-lock.mjs).";

type Env = Record<string, string | undefined>;
const env: Env = (globalThis as { process?: { env: Env } }).process?.env ?? {};
const first = (...names: string[]) => names.map((n) => env[n]).find((v) => v !== undefined && v !== "");

export type StackKeys = { url: string; anonKey: string; serviceKey: string };

/** The local stack's URL and keys, accepting the names `supabase status -o env` prints. */
export function stackKeys(): StackKeys | null {
  const url = first("SUPABASE_URL", "API_URL");
  const anonKey = first("SUPABASE_ANON_KEY", "ANON_KEY", "PUBLISHABLE_KEY");
  const serviceKey = first("SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY", "SECRET_KEY");
  return url && anonKey && serviceKey ? { url, anonKey, serviceKey } : null;
}

type Call = { method: "GET" | "POST" | "DELETE" | "OPTIONS"; key: string; token?: string; body?: unknown };

/** One request to the stack: its status and its body parsed as JSON (null when empty or not JSON). */
async function call(keys: StackKeys, path: string, c: Call): Promise<{ status: number; json: unknown }> {
  const headers: Record<string, string> = { apikey: c.key, Authorization: `Bearer ${c.token ?? c.key}` };
  if (c.body !== undefined) headers["Content-Type"] = "application/json";
  const init: RequestInit = { method: c.method, headers };
  if (c.body !== undefined) init.body = JSON.stringify(c.body);
  const reply = await fetch(`${keys.url}${path}`, init);
  const text = await reply.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    // An empty or non-JSON body stays null.
  }
  return { status: reply.status, json };
}

const FUNCTIONS = ["invite", "submit", "seen"];

/** Why the rehearsal can't run, or null when the stack and the invite, submit and seen functions all answer. */
export async function whyUnavailable(keys: StackKeys | null): Promise<string | null> {
  if (!keys) return "no local Supabase keys in the environment";
  try {
    const { status } = await call(keys, "/rest/v1/match?select=match_id&limit=1", {
      method: "GET",
      key: keys.serviceKey,
    });
    if (status === 0) return `the local Supabase stack at ${keys.url} did not answer`;
  } catch {
    return `the local Supabase stack at ${keys.url} did not answer`;
  }
  for (const name of FUNCTIONS) {
    const down = `the ${name} Edge Function did not answer OPTIONS with 204 (is \`supabase functions serve\` running?)`;
    try {
      const { status } = await call(keys, `/functions/v1/${name}`, { method: "OPTIONS", key: keys.anonKey });
      if (status !== 204) return `${down}, status ${status}`;
    } catch {
      return down;
    }
  }
  return null;
}

/** A signed-in test user: its id and access token. */
export type StackUser = { id: string; token: string };

const freshId = (): string => crypto.randomUUID();

/** Makes and signs in a fresh test user. */
export async function makeUser(keys: StackKeys, name: string): Promise<StackUser> {
  const email = `${name}-${freshId()}@terminal-dusk.test`;
  const password = freshId();
  const made = await call(keys, "/auth/v1/admin/users", {
    method: "POST",
    key: keys.serviceKey,
    body: { email, password, email_confirm: true },
  });
  const id = (made.json as { id?: unknown } | null)?.id;
  if (typeof id !== "string") throw new Error(`could not create the ${name} test user: status ${made.status}`);
  const signedIn = await call(keys, "/auth/v1/token?grant_type=password", {
    method: "POST",
    key: keys.anonKey,
    body: { email, password },
  });
  const token = (signedIn.json as { access_token?: unknown } | null)?.access_token;
  if (typeof token !== "string") throw new Error(`could not sign in the ${name} test user: status ${signedIn.status}`);
  return { id, token };
}

/** A new match made the way two players make one: `host` creates an invite and `joiner` joins it as SAE. */
export async function openMatch(
  keys: StackKeys,
  host: StackUser,
  joiner: StackUser,
): Promise<{ code: string; matchId: string }> {
  const invite = (user: StackUser, body: unknown) =>
    call(keys, "/functions/v1/invite", { method: "POST", key: keys.anonKey, token: user.token, body });
  const created = await invite(host, { action: "create", sides: { mode: "invitee" } });
  const code = (created.json as { code?: unknown } | null)?.code;
  if (typeof code !== "string") throw new Error(`could not create an invite: status ${created.status}`);
  const joined = await invite(joiner, { action: "join", code, side: "sae" });
  const matchId = (joined.json as { matchId?: unknown } | null)?.matchId;
  if (typeof matchId !== "string") throw new Error(`could not join the invite: status ${joined.status}`);
  return { code, matchId };
}

/** Reads one table's rows for one match with the service role. */
async function serviceRows<T>(keys: StackKeys, table: string, matchId: string, more: string[] = []): Promise<T[]> {
  const query = [`match_id=eq.${encodeURIComponent(matchId)}`, ...more].join("&");
  const { status, json } = await call(keys, `/rest/v1/${table}?${query}`, { method: "GET", key: keys.serviceKey });
  if (status !== 200 || !Array.isArray(json)) throw new Error(`could not read ${table}: status ${status}`);
  return json as T[];
}

/** What the server holds for `matchId` now: its secret, and each side's stored frame with that step's events. */
export async function serverSnapshot(keys: StackKeys, matchId: string): Promise<ServerSnapshot> {
  const [row] = await serviceRows<{ secret: MatchSecret }>(keys, "match_secret", matchId, ["select=secret"]);
  if (!row) throw new Error("the match has no secret row");
  const seq = row.secret.state.meta.seq;
  const views = await serviceRows<{ viewer: Viewer; frame: Frame }>(keys, "match_view", matchId, [
    "select=viewer,frame",
  ]);
  const events = await serviceRows<{ viewer: Viewer; events: Frame["events"] }>(keys, "match_event", matchId, [
    "select=viewer,events",
    `seq=eq.${seq}`,
  ]);
  const frameOf = (side: Side): Frame => {
    const view = views.find((v) => v.viewer === side);
    if (!view) throw new Error(`the match has no ${side} view row`);
    return { ...view.frame, events: events.find((e) => e.viewer === side)?.events ?? [] };
  };
  return { secret: row.secret, frames: { lio: frameOf("lio"), sae: frameOf("sae") } };
}

/** Removes the test matches (their invite, secret, view and event rows go with them) and the test users. */
export async function cleanUp(keys: StackKeys, matchIds: string[], users: StackUser[]): Promise<void> {
  const service = { key: keys.serviceKey };
  for (const matchId of matchIds) {
    await call(keys, `/rest/v1/match?match_id=eq.${encodeURIComponent(matchId)}`, { method: "DELETE", ...service });
  }
  for (const user of users) await call(keys, `/auth/v1/admin/users/${user.id}`, { method: "DELETE", ...service });
}
