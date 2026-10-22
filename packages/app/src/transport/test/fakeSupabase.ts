// A fake Supabase for the remote transport's tests: one match run by the real host, served over a fake
// `fetch`. Reads follow the O2 read rule (the spectator rows for anyone, a side's rows only for its player);
// the submit function answers like O4b. Every request is recorded so tests can check what was asked.
import type { Ruleset, Seed, Viewer } from "@terminal-dusk/engine";
import { hostCreate, hostSubmit } from "@terminal-dusk/host";
import type { HostResult, MatchConfig, Submission } from "@terminal-dusk/host";
import type { FetchLike, FetchReply } from "../remoteHttp.ts";

export const URL_BASE = "https://fake.supabase.test";
export const ANON_KEY = "fake-anon-key";

/** One request as the fake saw it. `params` keeps repeated query keys, in order. */
export type FakeRequest = {
  method: string;
  path: string;
  params: [string, string][];
  headers: Record<string, string>;
  body: unknown;
};

type EventRow = { match_id: string; seq: number; viewer: Viewer; events: unknown[] };

const VIEWERS: readonly Viewer[] = ["lio", "sae", "spectator"];
const STATUS: Record<string, number> = { notPlayer: 403, staleSeq: 409 };
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const reply = (status: number, body: unknown): FetchReply => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(copy(body)),
});

export type FakeSupabase = {
  fetch: FetchLike;
  requests: FakeRequest[];
  current(): HostResult;
  /** Applies a submission straight to the match, as another client's accepted answer would. */
  commit(submission: Submission): void;
  /** Makes the next request fail: thrown like a network error, or answered with this error status. */
  failNext(mode: "throw" | number): void;
  /** Holds every reply until the returned function is called. */
  hold(): () => void;
  /** Called with each request just before it is answered. */
  onRequest: ((request: FakeRequest) => void) | null;
};

export function createFakeSupabase(
  ruleset: Ruleset,
  config: MatchConfig,
  seed: Seed,
  tokens: Record<string, string>,
): FakeSupabase {
  const made = hostCreate(ruleset, config, seed, 1_000);
  if (!made.ok) throw new Error(made.error.code);
  let current = made.value;
  let now = 1_000;
  const eventRows: EventRow[] = [];
  const failures: ("throw" | number)[] = [];
  let gate: Promise<void> | null = null;

  const record = (h: HostResult): void => {
    for (const viewer of VIEWERS) {
      eventRows.push({ match_id: config.matchId, seq: h.record.seq, viewer, events: copy(h.frames[viewer].events) });
    }
  };
  record(current);

  const apply = (submission: Submission): ReturnType<typeof hostSubmit> => {
    const outcome = hostSubmit(ruleset, current.record, current.secret, submission, ++now);
    if (outcome.ok) {
      current = outcome.value;
      record(current);
    }
    return outcome;
  };

  /** The caller's player id; undefined when signed out; null for a token the fake does not know. */
  const caller = (headers: Record<string, string>): string | null | undefined => {
    const auth = headers.Authorization;
    if (auth === undefined) return undefined;
    return tokens[auth.replace(/^Bearer /, "")] ?? null;
  };

  const mayRead = (viewer: Viewer, player: string | undefined): boolean =>
    viewer === "spectator" || current.record.players[viewer] === player;

  const tableRows = (table: string, player: string | undefined): Record<string, unknown>[] | null => {
    const { record: r, frames } = current;
    if (table === "match") {
      return [{ match_id: r.matchId, lio_player: r.players.lio, sae_player: r.players.sae, seq: r.seq }];
    }
    if (table === "match_view") {
      return VIEWERS.filter((v) => mayRead(v, player)).map((v) => ({
        match_id: r.matchId,
        viewer: v,
        seq: frames[v].seq,
        frame: frames[v],
      }));
    }
    if (table === "match_event") return eventRows.filter((row) => mayRead(row.viewer, player));
    return null;
  };

  const matches = (row: Record<string, unknown>, key: string, filter: string): boolean => {
    const [op, value = ""] = filter.split(/\.(.*)/s);
    const cell = row[key];
    if (op === "eq") return String(cell) === value;
    const n = Number(value);
    if (typeof cell !== "number") return false;
    if (op === "gt") return cell > n;
    if (op === "gte") return cell >= n;
    if (op === "lt") return cell < n;
    if (op === "lte") return cell <= n;
    throw new Error(`fake: unknown filter ${filter}`);
  };

  const serveRest = (request: FakeRequest, table: string): FetchReply => {
    if (request.method !== "GET") return reply(405, { message: "read only" });
    const player = caller(request.headers);
    if (player === null) return reply(401, { message: "bad token" });
    const all = tableRows(table, player);
    if (all === null) return reply(404, { message: `no table ${table}` });
    let rows = all.filter((row) =>
      request.params.every(([k, v]) => k === "select" || k === "order" || matches(row, k, v)),
    );
    if (request.params.some(([k, v]) => k === "order" && v === "seq.asc")) {
      rows = [...rows].sort((a, b) => (a.seq as number) - (b.seq as number));
    }
    const select = request.params.find(([k]) => k === "select")?.[1];
    if (select !== undefined && select !== "*") {
      const cols = select.split(",");
      rows = rows.map((row) => Object.fromEntries(cols.map((c) => [c, row[c]])));
    }
    return reply(200, rows);
  };

  const refusal = (code: string): FetchReply =>
    reply(STATUS[code] ?? (code === "notSignedIn" ? 401 : code === "matchNotFound" ? 404 : 422), {
      ok: false,
      error: { code, message: `refused: ${code}` },
    });

  const serveSubmit = (request: FakeRequest): FetchReply => {
    if (request.method !== "POST") return refusal("methodNotAllowed");
    const player = caller(request.headers);
    if (typeof player !== "string") return refusal("notSignedIn");
    const body = request.body as { matchId?: unknown; submission?: Record<string, unknown> };
    if (body.matchId !== config.matchId) return refusal("matchNotFound");
    const s = body.submission ?? {};
    const submission = (
      s.resign === true
        ? { player, resign: true }
        : { player, decisionId: s.decisionId, expectedSeq: s.expectedSeq, value: s.value }
    ) as Submission;
    const outcome = apply(submission);
    if (!outcome.ok) return refusal(outcome.error.code);
    return reply(200, { ok: true, seq: outcome.value.record.seq });
  };

  const fake: FakeSupabase = {
    requests: [],
    onRequest: null,
    current: () => current,
    commit(submission) {
      const outcome = apply(submission);
      if (!outcome.ok) throw new Error(`fake commit refused: ${outcome.error.code}`);
    },
    failNext(mode) {
      failures.push(mode);
    },
    hold() {
      let release = (): void => undefined;
      gate = new Promise<void>((resolve) => {
        release = () => {
          gate = null;
          resolve();
        };
      });
      return release;
    },
    async fetch(url, init) {
      const parsed = new URL(url);
      const request: FakeRequest = {
        method: init.method,
        path: parsed.pathname,
        params: [...parsed.searchParams.entries()],
        headers: { ...init.headers },
        body: init.body === undefined ? undefined : JSON.parse(init.body),
      };
      fake.requests.push(request);
      if (gate !== null) await gate;
      const failure = failures.shift();
      if (failure === "throw") throw new TypeError("fake network failure");
      if (failure !== undefined) return reply(failure, { message: "fake error status" });
      fake.onRequest?.(request);
      if (url.slice(0, URL_BASE.length) !== URL_BASE) return reply(404, { message: "wrong host" });
      if (request.headers.apikey !== ANON_KEY) return reply(401, { message: "no apikey" });
      if (request.path === "/functions/v1/submit") return serveSubmit(request);
      const table = /^\/rest\/v1\/([a-z_]+)$/.exec(request.path)?.[1];
      return table === undefined ? reply(404, { message: "no route" }) : serveRest(request, table);
    },
  };
  return fake;
}
