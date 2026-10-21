// The online transport's HTTP side (docs/architecture.md, Decision 5): the client-readable rows it reads
// through Supabase's REST endpoints, and the submit function it posts to. Plain `fetch`, injected, so
// tests need no network; nothing here holds a URL, key or token of its own.
import type { GameEvent, Viewer } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";

/** The part of a fetch reply the transport uses. A real `Response` has it. */
export type FetchReply = { ok: boolean; status: number; json(): Promise<unknown> };
/** The part of `fetch` the transport uses. */
export type FetchLike = (
  url: string,
  init: { method: "GET" | "POST"; headers: Record<string, string>; body?: string },
) => Promise<FetchReply>;

/** Where the match lives and who is asking. `token` is the caller's access token, or null when signed out. */
export type Endpoint = { url: string; anonKey: string; matchId: string; fetch: FetchLike };

/** The two players of the match, from its `match` row. */
export type Seats = { lio: string; sae: string };

/** The events of one step, as one viewer may see them. */
export type StepEvents = { seq: number; events: GameEvent[] };

const headers = (anonKey: string, token: string | null): Record<string, string> => ({
  apikey: anonKey,
  Accept: "application/json",
  ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
});

/** GETs one table with PostgREST filters. A thrown error or an error status throws. */
async function select(e: Endpoint, token: string | null, table: string, query: string[]): Promise<unknown[]> {
  const reply = await e.fetch(`${e.url}/rest/v1/${table}?${query.join("&")}`, {
    method: "GET",
    headers: headers(e.anonKey, token),
  });
  if (!reply.ok) throw new Error(`read ${table}: status ${reply.status}`);
  const rows = await reply.json();
  if (!Array.isArray(rows)) throw new Error(`read ${table}: not a list`);
  return rows;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const matchFilter = (e: Endpoint): string => `match_id=eq.${encodeURIComponent(e.matchId)}`;

/** The match's two players, or null when there is no such match. Throws when the read fails. */
export async function readSeats(e: Endpoint, token: string | null): Promise<Seats | null> {
  const rows = await select(e, token, "match", ["select=lio_player,sae_player", matchFilter(e)]);
  const row = rows[0];
  if (row === undefined) return null;
  if (!isObject(row) || typeof row.lio_player !== "string" || typeof row.sae_player !== "string") {
    throw new Error("read match: bad row");
  }
  return { lio: row.lio_player, sae: row.sae_player };
}

/** The viewer's latest frame, or null when there is none to read. Throws when the read fails. */
export async function readFrame(e: Endpoint, token: string | null, viewer: Viewer): Promise<Frame | null> {
  const rows = await select(e, token, "match_view", ["select=seq,frame", matchFilter(e), `viewer=eq.${viewer}`]);
  const row = rows[0];
  if (!isObject(row) || !isObject(row.frame) || typeof row.seq !== "number") return null;
  return row.frame as Frame;
}

/** The viewer's events for every step with `after < seq <= upTo`, oldest first (`after` -1 means from seq 0). */
export async function readEvents(
  e: Endpoint,
  token: string | null,
  viewer: Viewer,
  after: number,
  upTo: number,
): Promise<StepEvents[]> {
  const rows = await select(e, token, "match_event", [
    "select=seq,events",
    matchFilter(e),
    `viewer=eq.${viewer}`,
    `seq=gt.${after}`,
    `seq=lte.${upTo}`,
    "order=seq.asc",
  ]);
  const steps: StepEvents[] = [];
  for (const row of rows) {
    if (!isObject(row) || typeof row.seq !== "number" || !Array.isArray(row.events)) {
      throw new Error("read match_event: bad row");
    }
    if (row.seq > after && row.seq <= upTo) steps.push({ seq: row.seq, events: row.events as GameEvent[] });
  }
  return steps.sort((a, b) => a.seq - b.seq);
}

/** The submit function's reply: accepted, refused with the server's code, or no usable reply at all. */
export type PostReply = { ok: true } | { ok: false; code: string; message?: string } | { ok: false; network: true };

/** POSTs one submission to the submit function. It never throws. */
export async function postSubmission(e: Endpoint, token: string, submission: unknown): Promise<PostReply> {
  let body: unknown;
  try {
    const reply = await e.fetch(`${e.url}/functions/v1/submit`, {
      method: "POST",
      headers: { ...headers(e.anonKey, token), "Content-Type": "application/json" },
      body: JSON.stringify({ matchId: e.matchId, submission }),
    });
    body = await reply.json();
  } catch {
    return { ok: false, network: true };
  }
  if (isObject(body) && body.ok === true) return { ok: true };
  if (isObject(body) && body.ok === false && isObject(body.error) && typeof body.error.code === "string") {
    const { code, message } = body.error;
    return typeof message === "string" ? { ok: false, code, message } : { ok: false, code };
  }
  return { ok: false, network: true };
}
