// The browser gate's leak check (A10): every response the stack sent to a browser is checked, for the side that
// browser plays, against what the server held at the step the response shows. No Playwright here, so Vitest
// proves it (helpers.test.ts). Reports name the kind of leak and the step, never a card (`withoutCards`).
import type { Side } from "@terminal-dusk/engine";
import type { MatchSecret } from "@terminal-dusk/host";
import { canonical, leaksFor, withoutCards } from "@terminal-dusk/host/test/secret-leaks";

/** One response the stack sent a browser: its body, and the server's step when it arrived. */
export type Recorded = { side: Side; url: string; text: string; atSeq: number };

/** The tables whose rows each carry their own step. */
const ROW_TABLES = /\/rest\/v1\/(match_view|match_event)$/;

/** Parses `text` as JSON, or null when it isn't. */
function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The highest step a match_view response shows (the frame its browser was just given), or null. */
export function frameSeqOf(response: Pick<Recorded, "url" | "text">): number | null {
  if (new URL(response.url).pathname !== "/rest/v1/match_view") return null;
  const rows = parse(response.text);
  if (!Array.isArray(rows)) return null;
  const seqs = rows.map((row: { seq?: unknown }) => row.seq).filter((seq): seq is number => typeof seq === "number");
  return seqs.length === 0 ? null : Math.max(...seqs);
}

/** The pieces of one body to check: each row of a match table with its own step, else the whole body. */
function piecesOf(response: Recorded): { seq: number; text: string; viewer?: unknown }[] {
  const parsed = ROW_TABLES.test(new URL(response.url).pathname) ? parse(response.text) : null;
  if (Array.isArray(parsed)) {
    return parsed.map((row: { seq?: unknown; frame?: { viewer?: unknown } }) => ({
      seq: typeof row.seq === "number" ? row.seq : response.atSeq,
      text: canonical(row),
      viewer: row.frame?.viewer,
    }));
  }
  const whole = parse(response.text);
  return [{ seq: response.atSeq, text: whole === null ? response.text : canonical(whole) }];
}

/** The problems in one piece of a response, checked against the secret of the piece's own step. */
function problemsIn(
  piece: { seq: number; text: string; viewer?: unknown },
  side: Side,
  where: string,
  secret: MatchSecret,
): string[] {
  const problems: string[] = [];
  if (piece.viewer !== undefined && piece.viewer !== side && piece.viewer !== "spectator") {
    problems.push(`seq ${piece.seq}, ${where}: the rival's frame`);
  }
  for (const leak of leaksFor(piece.text, secret, side)) {
    problems.push(`seq ${piece.seq}, ${where}: ${withoutCards(leak)}`);
  }
  return problems;
}

/** Rest and function replies are match-related; sign-in replies and the page's own files are not. */
const isMatchRelated = (url: string): boolean => /^\/(rest|functions)\/v1\//.test(new URL(url).pathname);

/**
 * Checks every match-related body in `responses` against the secret of its own step. Returns how many bodies it
 * checked and one line per problem, each naming the step, the side, the path and the kind of leak.
 */
export function checkResponses(
  responses: Recorded[],
  secrets: ReadonlyMap<number, MatchSecret>,
): { checked: number; problems: string[] } {
  const problems: string[] = [];
  let checked = 0;
  for (const response of responses) {
    if (response.text === "" || !isMatchRelated(response.url)) continue;
    checked += 1;
    const where = `${response.side}, ${new URL(response.url).pathname}`;
    for (const piece of piecesOf(response)) {
      const secret = secrets.get(piece.seq);
      if (!secret) {
        problems.push(`seq ${piece.seq}, ${where}: no server state was read for this step to check it against`);
        continue;
      }
      problems.push(...problemsIn(piece, response.side, where, secret));
    }
  }
  return { checked, problems };
}
