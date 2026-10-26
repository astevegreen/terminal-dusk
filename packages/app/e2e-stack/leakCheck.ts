// The browser gate's leak check (A10): every response the stack sent to a browser is checked, for the side that
// browser plays, against what the server held at the step the response shows. No Playwright here, so Vitest
// proves it (helpers.test.ts). Reports name the kind of leak and the step, never a card (`withoutCards`).
import type { Side } from "@terminal-dusk/engine";
import type { MatchSecret } from "@terminal-dusk/host";
import { canonical, leaksFor, withoutCards } from "../src/transport/test/leaks.ts";

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

/**
 * A rival's unrevealed pick whose card the viewer's own `knowledge` list shows is not a leak where that list is the
 * only place the card appears: the card is one the viewer was legitimately shown (such as by a revealed hand).
 * `leaksFor` exempts the viewer's own knowledge for the rival's hand cards but not for this finding (reported in the
 * pull request), and `src/transport/` is lane online's, so the exemption is made here, bound to that one list: the
 * finding is exempt only if it disappears once the `"knowledge":[...]` lists are taken out of the text.
 */
function isOwnKnowledge(leak: string, text: string, secret: MatchSecret, side: Side): boolean {
  const card = /^(?:lio|sae)'s unrevealed pick card "(.*)"$/.exec(leak)?.[1];
  if (card === undefined || !secret.state.private[side].knowledge.includes(card)) return false;
  const stripped = text.replace(/"knowledge":\[[^\]]*\]/g, '"knowledge":[]');
  return !leaksFor(stripped, secret, side).includes(leak);
}

/** The deck a Contingency order finding is about, or null. */
function deckOf(leak: string): "lio" | "sae" | "world" | null {
  if (leak === "the World deck's order") return "world";
  const side = /^(lio|sae)'s Contingency order$/.exec(leak)?.[1];
  return side === "lio" || side === "sae" ? side : null;
}

/**
 * A Contingency order is not a leak where it only shows up as that deck's public `left` list: `left` is public and
 * sorted, so when the hidden draw order happens to be ascending too, `leaksFor`'s plain substring search matches it by
 * chance. Exempt only when the order equals the state's public `left` for that deck and the finding disappears
 * once that deck's public `left` list alone is taken out of the text (reported in the pull request).
 */
function isPublicLeftList(leak: string, text: string, secret: MatchSecret, side: Side): boolean {
  const deck = deckOf(leak);
  if (deck === null) return false;
  const left = secret.state.public.contingency[deck].left;
  if (JSON.stringify(left) !== JSON.stringify(secret.state.secret.contingency[deck])) return false;
  const stripped = text.replace(/"(lio|sae|world)":\{"cards":\[[0-9,]*\],"left":\[[0-9,]*\]/g, (whole, name: string) =>
    name === deck ? whole.replace(/\[[0-9,]*\]$/, "[]") : whole,
  );
  return !leaksFor(stripped, secret, side).includes(leak);
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
    if (isOwnKnowledge(leak, piece.text, secret, side) || isPublicLeftList(leak, piece.text, secret, side)) continue;
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
