// Easy on cards with playedBy conditions (R5, issue #172).
import { reconstruct, SIDES, viewFor } from "@terminal-dusk/engine";
import type { CardId, GameEvent, Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { easyAnswer } from "./easy.ts";
import { guessHidden } from "./guess.ts";
import { seededRandom } from "./random.ts";
import { newPlayedByGame, parseBranch, playedByRuleset, playOf, shapeOf } from "./test/playedByGames.ts";
import type { How } from "./test/playedByGames.ts";
import { playEasy } from "./test/playEasy.ts";
import { applyTo } from "./test/testGames.ts";
import type { TestState } from "./test/testGames.ts";
import { EASY_WEIGHTS } from "./weights/easy.ts";

const GAMES = 50;

/** One branch a playedBy test took: its card, the side tested and the branch, with who last put the card in play and how. */
type Ran = { card: CardId; side: Side; branch: "then" | "else"; by: Side; how: How };

type Played = {
  /** Every game's last state. */
  finals: TestState[];
  /** The events of every apply, across all games. */
  events: GameEvent[];
  /** Every branch marker recorded, with the play of its card it read. */
  ran: Ran[];
  /** The sides that answered a yes/no; in this ruleset only a playedBy `then` branch asks one. */
  yesNoBy: Set<Side>;
  /** Every state a decision was pending in. */
  pending: TestState[];
};

const cardIndex = (card: CardId): number => Number(card.slice(1)) - 1;
const cardDef = (card: CardId) => playedByRuleset.cards[cardIndex(card)]!;

/** Plays one game with Easy on both sides (playEasy checks every answer), recording what the tests need. */
function playPlayedByGame(seed: number, into: Played): void {
  const plays = new Map<CardId, { by: Side; how: How }>();
  const final = playEasy(playedByRuleset, newPlayedByGame(seed), EASY_WEIGHTS, seededRandom(seed), {
    name: `game ${seed}`,
    applied: (before, _after, events, answer) => {
      into.pending.push(before);
      const play = playOf(answer.value);
      if (play !== null) plays.set(play.card, { by: answer.side, how: play.how });
      if (answer.value.kind === "yesNo") into.yesNoBy.add(answer.side);
      into.events.push(...events);
      for (const event of events) {
        const branch = event.kind === "marker" ? parseBranch(event.label) : null;
        if (branch === null) continue;
        const record = plays.get(branch.card);
        if (record === undefined) throw new Error(`card ${branch.card} ran a branch, but no side played it`);
        into.ran.push({ ...branch, ...record });
      }
    },
  });
  into.finals.push(final);
}

let cached: Played | null = null;
/** The 50 seeded games, played once and shared by the tests below. */
function played(): Played {
  if (cached !== null) return cached;
  const into: Played = { finals: [], events: [], ran: [], yesNoBy: new Set(), pending: [] };
  for (let seed = 1; seed <= GAMES; seed++) playPlayedByGame(seed, into);
  cached = into;
  return into;
}

const markers = (events: readonly GameEvent[]): string[] =>
  events.flatMap((e) => (e.kind === "marker" ? [e.label] : []));

describe("Easy with playedBy conditions", () => {
  it("the playedBy ruleset is accepted by createGame, with LIO, SAE and neutral cards of every shape", () => {
    // dealGame throws unless createGame answers ok: true.
    for (let seed = 1; seed <= GAMES; seed++) expect(newPlayedByGame(seed).public.status.kind).toBe("active");
    const shapes = new Set(playedByRuleset.cards.map((card, i) => `${card.affiliation}:${shapeOf(i)}`));
    for (const affiliation of ["lio", "sae", "neutral"]) {
      for (const shape of ["lio", "sae", "turnEnd"]) expect(shapes).toContain(`${affiliation}:${shape}`);
    }
  });

  it("plays 50 seeded games on both sides with only legal answers, and every game ends", () => {
    const { finals } = played();
    expect(finals).toHaveLength(GAMES);
    for (const final of finals) expect(final.public.status.kind).toBe("over");
  });

  it("records all four branches, and both LIO and SAE answer a choose inside a playedBy branch", () => {
    const kinds = new Set(played().ran.map((r) => `${r.side}-${r.branch}`));
    expect(kinds).toEqual(new Set(["lio-then", "lio-else", "sae-then", "sae-else"]));
    expect(played().yesNoBy).toEqual(new Set(["lio", "sae"]));
  });

  it("each branch read who played the card: then exactly when the side tested last picked or played it", () => {
    for (const r of played().ran) expect({ ...r, branch: r.by === r.side ? "then" : "else" }).toEqual(r);
  });

  it("runs a branch in a turnEnd trigger, a neutral card, a rival's card played for points and an opening pick", () => {
    const { ran } = played();
    const rival = (r: Ran) => cardDef(r.card).affiliation !== "neutral" && cardDef(r.card).affiliation !== r.by;
    expect(ran.some((r) => shapeOf(cardIndex(r.card)) === "turnEnd")).toBe(true);
    expect(ran.some((r) => cardDef(r.card).affiliation === "neutral")).toBe(true);
    expect(ran.some((r) => r.how === "points" && rival(r))).toBe(true);
    expect(ran.some((r) => r.how === "opening")).toBe(true);
  });

  it("rebuilds every pending state, paused choices included, with the real public part, own private part and meta", () => {
    const { pending } = played();
    expect(pending.some((s) => s.public.pending.some((d) => d.kind === "yesNo"))).toBe(true);
    for (const [i, state] of pending.entries()) {
      for (const side of SIDES) {
        const view = viewFor(state, side);
        const rebuilt = reconstruct(view, guessHidden(playedByRuleset, view, side, seededRandom(i + 1)));
        expect(rebuilt.public).toEqual(state.public);
        expect(rebuilt.private[side]).toEqual(state.private[side]);
        expect(rebuilt.meta).toEqual(state.meta);
      }
    }
  });

  // The choice asks both sides at once. Once one side has answered, its answer is its own secret, which the
  // other side's rebuilt state cannot hold (guessHidden guesses no rival picks). So this starts where both
  // still have to answer: Easy answers for the side that rebuilt, then for the rival, on each state.
  it("applying Easy's answer to a choice inside a playedBy branch records the same markers on the rebuilt and real state", () => {
    const bothAsked = (s: TestState) =>
      SIDES.every((side) => s.public.pending.some((d) => d.side === side && d.kind === "yesNo"));
    let branchMarkers = 0;
    for (const [i, state] of played().pending.filter(bothAsked).entries()) {
      for (const side of SIDES) {
        const view = viewFor(state, side);
        const rebuilt = reconstruct(view, guessHidden(playedByRuleset, view, side, seededRandom(i + 3)));
        const order: Side[] = side === "lio" ? ["lio", "sae"] : ["sae", "lio"];
        const answers = order.map((s) => {
          const value = easyAnswer(playedByRuleset, viewFor(state, s), s, EASY_WEIGHTS, seededRandom(i + 7));
          expect(value).not.toBeNull();
          const decision = state.public.pending.find((d) => d.side === s)!;
          return { decisionId: decision.id, side: s, value: value! };
        });
        const markersOf = (start: TestState): string[] => {
          let at = start;
          return answers.flatMap((answer) => {
            const r = applyTo(playedByRuleset, at, answer);
            at = r.state;
            return markers(r.events);
          });
        };
        const real = markersOf(state);
        expect(markersOf(rebuilt)).toEqual(real);
        if (real.some((label) => parseBranch(label)?.branch === "then")) branchMarkers++;
      }
    }
    expect(branchMarkers).toBeGreaterThan(0);
  });
});
