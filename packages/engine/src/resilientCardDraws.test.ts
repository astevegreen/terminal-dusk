// Resilient institutions in a card's event follows whose play it is (docs/design/contingency-deck.md, "Whose
// bonuses apply"; docs/design/sides.md). The redraw covers a draw only from LIO's own deck, in a card LIO played.
// A draw from SAE's deck in LIO's card (e1-lio-004, e2-lio-011, e3-lio-015) never redraws, nor does the World deck
// standing in for SAE's when LIO plays SAE's card (owner, 26 Nov 2026: "No redraw"); a card SAE played never
// redraws, even from LIO's deck; when both sides draw, only the player's draw can ("LIO's own draw only"). Draws outside card events: resilientRedrawCallers.test.ts.
import { describe, expect, it } from "vitest";
import type { CardId, GameState, Setup, Side, Step } from "./index.ts";
import { startProgram } from "./stack.ts";
import { marker, markers, ruleset } from "./test/game.ts";
import { mapSetup } from "./test/map.ts";
import { drawn, drawsNext, game, redraws } from "./test/redraw.ts";

/** Both sides with Resilient institutions, to show it is the player's that applies, never the deck owner's. */
const BOTH: NonNullable<Setup["abilities"]> = {
  lio: { id: "resilientInstitutions", perTurn: 1 },
  sae: { id: "resilientInstitutions", perTurn: 1 },
};

/** A World deck that can show a 1 then a 4. */
const WORLD: Setup = { ...mapSetup(), contingency: { ...mapSetup().contingency, world: [1, 1, 2, 3, 4, 4] } };

/** A LIO deck with two 1s, so LIO can draw a 1 again after its redraw. */
const TWO_ONES: Setup = { ...mapSetup(), contingency: { ...mapSetup().contingency, lio: [1, 1, 2, 3, 4, 4] } };

const draw = (side: Side | "player", bind: string, madeFor?: Side): Step[] => [
  madeFor === undefined ? { op: "drawContingency", side, bind } : { op: "drawContingency", side, bind, madeFor },
  marker(`drew-${bind}`, bind),
];

/** Runs `steps` as the event of `card`, played by `player`; `worldFor` is the card's owner when it is the rival's. */
function event(start: GameState, steps: Step[], card: CardId, player: Side, worldFor?: Side) {
  const r = startProgram(ruleset, start, steps, card, player, worldFor);
  if (!r.ok) throw new Error(r.error.code);
  return r.value;
}

const used = (state: GameState, side: Side) => (state.public.abilities![side] as { used: number }).used;
const redraw = (side: Side, deck: string) => ({
  kind: "abilityRedraw",
  visibility: "public",
  side,
  deck,
  setAside: 1,
});

describe("Resilient institutions in a card's event", () => {
  it("LIO plays SAE's card: its draw from SAE's deck comes from the World deck and is not redrawn", () => {
    const start = drawsNext(game(WORLD), "world", [1, 4]);
    const done = event(start, draw("sae", "n"), "s1", "lio", "sae");
    expect(drawn(done.events)).toEqual(["world:1"]);
    expect(redraws(done.events)).toEqual([]);
    expect(markers(done.events)).toEqual(["drew-n:1"]);
    expect(used(done.state, "lio")).toBe(0);
  });

  it("SAE plays LIO's card: the World deck stands in for LIO's and nothing is redrawn", () => {
    const start = drawsNext(game(WORLD), "world", [1, 4]);
    const done = event(start, draw("lio", "n"), "l1", "sae", "lio");
    expect(drawn(done.events)).toEqual(["world:1"]);
    expect(redraws(done.events)).toEqual([]);
    expect(used(done.state, "lio")).toBe(0);
  });

  it("SAE's own card drawing LIO's deck (for LIO's choice) is SAE's play: LIO's 1 stands", () => {
    const done = event(game(), draw("lio", "n"), "s1", "sae");
    expect(drawn(done.events)).toEqual(["lio:1"]);
    expect(redraws(done.events)).toEqual([]);
    expect(markers(done.events)).toEqual(["drew-n:1"]);
    expect(used(done.state, "lio")).toBe(0);
  });

  it("LIO plays SAE's card drawing LIO's deck (e1-sae-011, e2-sae-002): LIO's draw is redrawn", () => {
    const done = event(game(), draw("lio", "n"), "s1", "lio", "sae");
    expect(drawn(done.events)).toEqual(["lio:1", "lio:4"]);
    expect(redraws(done.events)).toEqual([redraw("lio", "lio")]);
  });

  it("LIO's own card drawing SAE's deck (e1-lio-004): the draw is SAE's, so neither side redraws it", () => {
    const start = drawsNext(game(mapSetup(), ruleset, BOTH), "sae", [1, 4]);
    const done = event(start, draw("sae", "n"), "l1", "lio");
    expect(drawn(done.events)).toEqual(["sae:1"]);
    expect(redraws(done.events)).toEqual([]);
    expect(markers(done.events)).toEqual(["drew-n:1"]);
    expect([used(done.state, "lio"), used(done.state, "sae")]).toEqual([0, 0]);
  });

  it("a neutral card's draw from the player's deck: LIO's play is redrawn, SAE's play from SAE's deck is SAE's", () => {
    const lio = event(game(), draw("player", "n"), "n1", "lio");
    expect(drawn(lio.events)).toEqual(["lio:1", "lio:4"]);
    expect(redraws(lio.events)).toEqual([redraw("lio", "lio")]);
    const start = drawsNext(game(mapSetup(), ruleset, BOTH), "sae", [1, 4]);
    const sae = event(start, draw("player", "n"), "n1", "sae");
    expect(drawn(sae.events)).toEqual(["sae:1", "sae:4"]);
    expect(redraws(sae.events)).toEqual([redraw("sae", "sae")]);
    expect(used(sae.state, "lio")).toBe(0);
  });

  it("when LIO's card makes both sides draw, only LIO's draw is redrawn, even with SAE's own redraw left", () => {
    const start = drawsNext(game(mapSetup(), ruleset, BOTH), "sae", [1, 4]);
    const done = event(start, [...draw("lio", "a"), ...draw("sae", "b")], "n1", "lio");
    expect(drawn(done.events)).toEqual(["lio:1", "lio:4", "sae:1"]);
    expect(redraws(done.events)).toEqual([redraw("lio", "lio")]);
    expect(markers(done.events)).toEqual(["drew-a:4", "drew-b:1"]);
    expect([used(done.state, "lio"), used(done.state, "sae")]).toEqual([1, 0]);
  });

  it("when SAE's card makes both sides draw, LIO's 1 stands: it is SAE's play", () => {
    const start = drawsNext(game(), "sae", [2]);
    const done = event(start, [...draw("lio", "a"), ...draw("sae", "b")], "n1", "sae");
    expect(drawn(done.events)).toEqual(["lio:1", "sae:2"]);
    expect(redraws(done.events)).toEqual([]);
    expect(used(done.state, "lio")).toBe(0);
  });

  it("a neutral card's draw from LIO's deck made for SAE (e3-neu-005): LIO plays it and SAE's draw is not redrawn", () => {
    const done = event(game(), draw("player", "n", "sae"), "n1", "lio");
    expect(drawn(done.events)).toEqual(["lio:1"]);
    expect(redraws(done.events)).toEqual([]);
    expect(markers(done.events)).toEqual(["drew-n:1"]);
    expect(used(done.state, "lio")).toBe(0);
  });

  it("a neutral card's draw made for LIO, the player, is still redrawn", () => {
    const done = event(game(), draw("player", "n", "lio"), "n1", "lio");
    expect(drawn(done.events)).toEqual(["lio:1", "lio:4"]);
    expect(redraws(done.events)).toEqual([redraw("lio", "lio")]);
  });

  it("SAE plays a neutral card: its draw from SAE's deck made for LIO is not redrawn by either side", () => {
    const start = drawsNext(game(mapSetup(), ruleset, BOTH), "sae", [1, 4]);
    const done = event(start, draw("player", "n", "lio"), "n1", "sae");
    expect(drawn(done.events)).toEqual(["sae:1"]);
    expect(redraws(done.events)).toEqual([]);
    expect([used(done.state, "lio"), used(done.state, "sae")]).toEqual([0, 0]);
  });

  it("one use a turn: after LIO's redraw in its play, LIO's next 1 stands", () => {
    const start = drawsNext(game(TWO_ONES), "lio", [1, 4, 1]);
    const done = event(start, [...draw("lio", "a"), ...draw("lio", "b")], "l1", "lio");
    expect(drawn(done.events)).toEqual(["lio:1", "lio:4", "lio:1"]);
    expect(redraws(done.events)).toEqual([redraw("lio", "lio")]);
    expect(markers(done.events)).toEqual(["drew-a:4", "drew-b:1"]);
    expect(used(done.state, "lio")).toBe(1);
  });
});
