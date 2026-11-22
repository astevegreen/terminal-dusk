// #602: LIO's Resilient institutions (docs/design/sides.md, "Asymmetry"). The first time in a turn that a draw from
// LIO's own Contingency deck shows a 1, that card is set aside and LIO draws again. Not the crisis draw, which does
// not use it up either (owner, 21 Nov 2026: "Take all"); not SAE's deck, nor the World deck.
import { describe, expect, it } from "vitest";
import { drawContingency } from "./contingency.ts";
import { copyJson } from "./copy.ts";
import { raiseEscalation } from "./escalation.ts";
import { createGame } from "./index.ts";
import type { DeckId, GameEvent, GameState, Setup } from "./index.ts";
import { makeSetup, playAnswers, ruleset } from "./test/game.ts";
import { mapSetup } from "./test/map.ts";

const ABILITIES: NonNullable<Setup["abilities"]> = {
  lio: { id: "resilientInstitutions", perTurn: 1 },
  sae: { id: "unifiedCommand", bonus: 1 },
};

/** A working copy, as apply's helpers get it, of a game at LIO's first play, with `order` on top of `deck`. */
function working(deck: DeckId, order: number[], setup: Setup = makeSetup(), perTurn = 1): GameState {
  const contingency = { ...setup.contingency, [deck]: [...order].sort((a, b) => a - b) };
  const abilities = { ...ABILITIES, lio: { id: "resilientInstitutions" as const, perTurn } };
  const r = createGame(ruleset, { ...setup, contingency, abilities }, "seed-1");
  if (!r.ok) throw new Error(`createGame failed: ${r.error.message}`);
  const state = copyJson(playAnswers(r.value.state, 2));
  state.secret.contingency[deck] = [...order];
  state.public.contingency[deck].left = [...order].sort((a, b) => a - b);
  return state;
}

const drawn = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.kind === "contingencyDrawn" ? [`${e.deck}:${e.value}`] : []));

describe("Resilient institutions", () => {
  it("a 1 from LIO's deck is set aside and LIO draws again", () => {
    const s = working("lio", [1, 4, 2, 5, 3, 6]);
    const events: GameEvent[] = [];
    expect(drawContingency(s, "lio", events)).toBe(4);
    expect(events).toEqual([
      { kind: "contingencyDrawn", visibility: "public", deck: "lio", value: 1 },
      { kind: "abilityRedraw", visibility: "public", side: "lio", deck: "lio", setAside: 1 },
      { kind: "contingencyDrawn", visibility: "public", deck: "lio", value: 4 },
    ]);
    expect(s.public.contingency.lio.left).toEqual([2, 3, 5, 6]);
    expect(s.public.abilities!.lio).toEqual({ id: "resilientInstitutions", perTurn: 1, used: 1 });
  });

  it("works only once a turn: the next 1 that turn stands", () => {
    const s = working("lio", [1, 1, 2, 3, 4, 5]);
    const events: GameEvent[] = [];
    expect(drawContingency(s, "lio", events)).toBe(1);
    expect(drawn(events)).toEqual(["lio:1", "lio:1"]);
  });

  it("works as many times a turn as the scenario's perTurn says, one redraw per draw", () => {
    // The second draw stands even if it is a 1 (#602); a later draw that turn may use the second redraw.
    const s = working("lio", [1, 1, 1, 3, 2, 4], makeSetup(), 2);
    expect(drawContingency(s, "lio", [])).toBe(1);
    expect(s.public.abilities!.lio).toMatchObject({ used: 1 });
    expect(drawContingency(s, "lio", [])).toBe(3);
    expect(s.public.abilities!.lio).toMatchObject({ used: 2 });
  });

  it("any other number stands and does not use it up", () => {
    const s = working("lio", [3, 1, 2, 4, 5, 6]);
    expect(drawContingency(s, "lio", [])).toBe(3);
    expect(s.public.abilities!.lio).toMatchObject({ used: 0 });
    expect(drawContingency(s, "lio", [])).toBe(2);
  });

  it.each(["sae", "world"] as const)("a 1 from the %s deck stands", (deck) => {
    const s = working(deck, [1, 4, 2, 5, 3, 6]);
    const events: GameEvent[] = [];
    expect(drawContingency(s, deck, events)).toBe(1);
    expect(events.some((e) => e.kind === "abilityRedraw")).toBe(false);
    expect(s.public.abilities!.lio).toMatchObject({ used: 0 });
  });

  it("does not apply to a crisis draw, which does not use it up", () => {
    const s = working("lio", [1, 1, 4, 2, 5, 3], mapSetup());
    s.public.escalation = 5;
    const events: GameEvent[] = [];
    raiseEscalation(s, 1, "lio", events);
    expect(drawn(events)).toEqual(["lio:1"]);
    expect(events).toContainEqual({ kind: "escalationCrisis", visibility: "public", side: "lio", value: 1 });
    expect(s.public.abilities!.lio).toMatchObject({ used: 0 });
    expect(drawContingency(s, "lio", [])).toBe(4);
    expect(s.public.abilities!.lio).toMatchObject({ used: 1 });
  });

  it("a game without abilities draws a 1 as it is", () => {
    const r = createGame(ruleset, makeSetup(), "seed-1");
    if (!r.ok) throw new Error("createGame failed");
    const s = copyJson(r.value.state);
    s.secret.contingency.lio = [1, 2, 3, 4, 5, 6];
    expect(drawContingency(s, "lio", [])).toBe(1);
  });
});
