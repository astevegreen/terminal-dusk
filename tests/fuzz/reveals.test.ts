// The fuzz suite and the revealHand step of R6a (#185): the fuzz cards show hands at the top level, inside an if
// and in both kinds of reaction, and the fuzz games reach every kind of reveal while every check runs.
import { apply, createGame } from "@terminal-dusk/engine";
import type { Answer, CardDef, CardId, GameEvent, GameState, Ruleset, Side, Step } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { DEFAULT_GAMES, playFuzzGame, ruleset } from "./play.ts";
import type { GameRecord } from "./play.ts";
import { playReactionGame, reactionsRuleset } from "./reactions.ts";
import { announcedReveal } from "./reveals.ts";
import type { RevealWhere } from "./reveals.ts";

type Found = { where: RevealWhere; side: Side; affiliation: CardDef["affiliation"] };

/** Every announced revealHand in `steps`, at any depth, with the announcement straight before it. */
function revealsIn(steps: readonly Step[], affiliation: CardDef["affiliation"]): Found[] {
  return steps.flatMap((step, i) => {
    const before = steps[i - 1];
    const label = before?.op === "marker" ? before.label : "";
    const announced = announcedReveal({ kind: "marker", visibility: "public", label });
    if (step.op === "revealHand" && announced?.side !== step.side)
      throw new Error(`reveal of ${step.side} not announced`);
    const own =
      step.op === "revealHand" && announced !== null ? [{ where: announced.where, side: step.side, affiliation }] : [];
    const inner = step.op === "if" ? [...step.then, ...(step.else ?? [])] : step.op === "trigger" ? step.do : [];
    return [...own, ...revealsIn(inner, affiliation)];
  });
}
const revealsOf = (rules: Ruleset) => rules.cards.flatMap((card) => revealsIn(card.effect, card.affiliation));

describe("the fuzz cards show hands with revealHand", () => {
  const found = [...revealsOf(ruleset), ...revealsOf(reactionsRuleset)];
  it("show LIO's and SAE's hand on LIO, SAE and neutral cards, at the top level, in an if, and in both kinds of reaction", () => {
    for (const where of ["top", "nested", "turnEnd", "cardPlayed"] as const) {
      const at = found.filter((f) => f.where === where);
      for (const side of ["lio", "sae"] as const) {
        const affiliations = new Set(at.filter((f) => f.side === side).map((f) => f.affiliation));
        expect(affiliations, `${where} ${side}`).toEqual(new Set(["lio", "sae", "neutral"]));
      }
    }
  });
  it("announce each reveal with a marker straight before it naming its place and side, the reaction ones on their hook", () => {
    expect(found.length).toBeGreaterThan(0);
    const inReactions = revealsOf(reactionsRuleset);
    expect(new Set(inReactions.map((f) => f.where))).toEqual(new Set(["turnEnd", "cardPlayed"]));
    expect(new Set(revealsOf(ruleset).map((f) => f.where))).toEqual(new Set(["top", "nested"]));
  });
  it("keep every card's id and affiliation", () => {
    expect(reactionsRuleset.cards.map((c) => [c.id, c.affiliation])).toEqual(
      ruleset.cards.map((c) => [c.id, c.affiliation]),
    );
  });
});

type Counts = {
  lio: number;
  sae: number;
  allKnown: number;
  top: number;
  nested: number;
  turnEnd: number;
  cardPlayed: number;
  playedAndForgotten: number;
};
const zero = (): Counts => ({
  lio: 0,
  sae: 0,
  allKnown: 0,
  top: 0,
  nested: 0,
  turnEnd: 0,
  cardPlayed: 0,
  playedAndForgotten: 0,
});
const other = (side: Side): Side => (side === "lio" ? "sae" : "lio");

/** The card an answer picks or plays, or null. */
function cardOf(answer: Answer): CardId | null {
  if (!("value" in answer)) return null;
  const { value } = answer;
  return value.kind === "chooseCard" || value.kind === "playCardAs" ? value.card : null;
}

/** Adds one step's reveals to `counts`: `before` and `after` are the states around it, `events` its events. */
function countStep(counts: Counts, before: GameState, after: GameState, events: readonly GameEvent[], answer: Answer) {
  const known: Record<Side, CardId[]> = {
    lio: [...before.private.lio.knowledge],
    sae: [...before.private.sae.knowledge],
  };
  events.forEach((event, i) => {
    if (event.kind !== "handRevealed") return;
    const announced = i > 0 ? announcedReveal(events[i - 1]!) : null;
    expect(announced?.side).toBe(event.side);
    counts[event.side]++;
    counts[announced!.where]++;
    const peeker = other(event.side);
    if (event.cards.length > 0 && event.cards.every((c) => known[peeker].includes(c))) counts.allKnown++;
    known[peeker].push(...event.cards);
  });
  const card = cardOf(answer);
  if (card === null || !("value" in answer)) return;
  const rival = other(answer.side);
  if (before.private[rival].knowledge.includes(card) && !after.private[rival].knowledge.includes(card)) {
    counts.playedAndForgotten++;
  }
}

/** Replays a played game step by step, counting its reveals into `counts`. */
function countGame(counts: Counts, rules: Ruleset, record: GameRecord): void {
  const created = createGame(rules, record.setup, record.seed);
  if (!created.ok) throw new Error(`createGame failed: ${created.error.code}`);
  let state = created.value.state;
  for (const answer of record.answers) {
    const r = apply(rules, state, answer);
    if (!r.ok) throw new Error(`apply failed: ${r.error.code}`);
    countStep(counts, state, r.value.state, r.value.events, answer);
    state = r.value.state;
  }
}

describe("revealHand in the fuzz games", () => {
  it(`within ${DEFAULT_GAMES} fuzz games and as many reaction games, every kind of reveal happens and a shown card is played and forgotten`, () => {
    const counts = zero();
    for (let game = 1; game <= DEFAULT_GAMES; game++) {
      // Each game runs every check, the knowledge check included, and throws with its record if one fails.
      countGame(counts, ruleset, playFuzzGame(game).record);
      countGame(counts, reactionsRuleset, playReactionGame(game).record);
    }
    for (const [what, n] of Object.entries(counts)) expect(n, what).toBeGreaterThan(0);
  }, 120_000);
});
