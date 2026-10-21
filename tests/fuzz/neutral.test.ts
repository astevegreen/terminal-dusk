// Neutral events in the fuzz games (#117): neutral cards draw from the deck of the side that picked or played
// them, in their events and in the reactions they set, and the whose-deck check (playerDraws.ts) catches a
// draw from the wrong deck.
import { apply, createGame } from "@terminal-dusk/engine";
import type { CardId, DeckId, GameEvent, Ruleset, Side, Step } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { gameCount, playFuzzGame, ruleset } from "./play.ts";
import type { GameRecord, Played } from "./play.ts";
import { announcedDraw, checkPlayerDraws, PLAYER_DRAW } from "./playerDraws.ts";
import { playReactionGame, reactionsRuleset } from "./reactions.ts";

// tests/ has no Node type definitions; this is the one Node global the suite reads.
declare const process: { readonly env: Readonly<Record<string, string | undefined>> };

const GAMES = Math.min(gameCount(process.env["FUZZ_GAMES"]), 200);

const marked = (card: CardId, inReaction = false): GameEvent => ({
  kind: "marker",
  visibility: "public",
  label: `${PLAYER_DRAW}${card}${inReaction ? ":reaction" : ""}`,
});
const drawn = (deck: DeckId): GameEvent => ({ kind: "contingencyDrawn", visibility: "public", deck, value: 3 });
const reshuffled = (deck: DeckId): GameEvent => ({ kind: "contingencyDeckReshuffled", visibility: "public", deck });

describe("the whose-deck check", () => {
  const players = new Map<CardId, Side>([["c3", "lio"]]);
  it("passes a neutral card's draw, and its reshuffle, from the deck of the side that played or picked it", () => {
    expect(() => checkPlayerDraws([marked("c3"), drawn("lio"), reshuffled("lio")], players)).not.toThrow();
    expect(() => checkPlayerDraws([marked("c3", true), drawn("lio")], players)).not.toThrow();
  });
  it("fails a draw from the other side's deck", () => {
    expect(() => checkPlayerDraws([marked("c3"), drawn("sae")], players)).toThrow(/c3.*sae's deck.*lio picked/);
    expect(() => checkPlayerDraws([marked("c3", true), drawn("sae")], players)).toThrow(/c3/);
  });
  it("fails a neutral card's draw from the World deck, which only a rival's card draws from (#131)", () => {
    expect(() => checkPlayerDraws([marked("c3"), drawn("world")], players)).toThrow(/c3.*world's deck.*lio picked/);
  });
  it("fails a reshuffle of the other side's deck after the right draw", () => {
    expect(() => checkPlayerDraws([marked("c3"), drawn("lio"), reshuffled("sae")], players)).toThrow(/c3/);
  });
  it("fails an announced draw that drew nothing, or one for a card no side picked or played", () => {
    expect(() => checkPlayerDraws([marked("c3")], players)).toThrow(/drew nothing/);
    expect(() => checkPlayerDraws([marked("c6"), drawn("lio")], players)).toThrow(/no side/);
  });
});

/** Every "player" draw in `steps` (nested blocks and reactions too), with the marker straight before it. */
function playerDraws(steps: readonly Step[]): { before: Step | undefined }[] {
  return steps.flatMap((step, i) => {
    const own = step.op === "drawContingency" && step.side === "player" ? [{ before: steps[i - 1] }] : [];
    const inner = step.op === "if" ? [...step.then, ...(step.else ?? [])] : "do" in step ? step.do : [];
    return [...own, ...playerDraws(inner)];
  });
}

describe("the fuzz cards", () => {
  it.each([
    ["fuzz", ruleset],
    ["reaction", reactionsRuleset],
  ] as const)(
    "on the %s cards, every draw from the player's deck is a neutral card's, announced with its id",
    (_, rules) => {
      let draws = 0;
      for (const card of rules.cards) {
        for (const { before } of playerDraws(card.effect)) {
          draws++;
          expect(card.affiliation).toBe("neutral");
          const label = before?.op === "marker" ? before.label : "";
          expect(announcedDraw({ kind: "marker", visibility: "public", label })?.card).toBe(card.id);
        }
      }
      expect(draws).toBeGreaterThan(0);
    },
  );
});

/** The events of a played game, replayed answer by answer. */
function eventsOf(rules: Ruleset, record: GameRecord): GameEvent[] {
  const created = createGame(rules, record.setup, record.seed);
  if (!created.ok) throw new Error(`createGame failed: ${created.error.code}`);
  let state = created.value.state;
  const events = [...created.value.events];
  for (const answer of record.answers) {
    const r = apply(rules, state, answer);
    if (!r.ok) throw new Error(`apply failed: ${r.error.code}`);
    state = r.value.state;
    events.push(...r.value.events);
  }
  return events;
}

type Counts = { neutralEvents: number; neutralOpenings: number; eventDraws: number; reactionDraws: number };

/** Adds game `played`'s neutral events, neutral opening picks and announced draws to `counts`. */
function count(counts: Counts, rules: Ruleset, played: Played): void {
  const neutral = new Set(rules.cards.filter((c) => c.affiliation === "neutral").map((c) => c.id));
  for (const answer of played.record.answers) {
    if (!("value" in answer)) continue;
    const { value } = answer;
    if (value.kind === "chooseCard" && neutral.has(value.card)) {
      counts.neutralOpenings++;
      counts.neutralEvents++;
    }
    if (value.kind === "playCardAs" && value.as === "event" && neutral.has(value.card)) counts.neutralEvents++;
  }
  for (const event of eventsOf(rules, played.record)) {
    const announced = announcedDraw(event);
    if (announced?.inReaction === true) counts.reactionDraws++;
    if (announced?.inReaction === false) counts.eventDraws++;
  }
}

describe("neutral events in the fuzz games", () => {
  it(`over ${GAMES} fuzz games and as many reaction games: neutral events, neutral opening picks, and draws in neutral events and their reactions all happen`, () => {
    const counts: Counts = { neutralEvents: 0, neutralOpenings: 0, eventDraws: 0, reactionDraws: 0 };
    for (let game = 1; game <= GAMES; game++) {
      // Each game runs every check, the whose-deck check included, and throws with its record if one fails.
      count(counts, ruleset, playFuzzGame(game));
      count(counts, reactionsRuleset, playReactionGame(game));
    }
    expect(counts.neutralEvents).toBeGreaterThan(0);
    expect(counts.neutralOpenings).toBeGreaterThan(0);
    expect(counts.eventDraws).toBeGreaterThan(0);
    expect(counts.reactionDraws).toBeGreaterThan(0);
  }, 120_000);
});
