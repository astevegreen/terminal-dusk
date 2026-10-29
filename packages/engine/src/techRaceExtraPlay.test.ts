// R26b (#470): Hypersonics' extra play (docs/design/tech-race.md, "The extra play"). After both sides have made all
// their normal plays for the turn, the side holding Hypersonics may play one more card from its hand. It is optional,
// and an ordinary play: for the event or the points, on any action, with a tech race attempt only if the side has
// not made its one attempt this turn. The turn-end rules come after it.
import { describe, expect, it } from "vitest";
import { apply } from "./apply.ts";
import { legalAnswers } from "./decisions.ts";
import type { Answer, AnswerValue, GameState, Ruleset, Side, Step } from "./index.ts";
import { applied, marker, playAnswer } from "./test/game.ts";
import { choose, menu, raceGame, raceRules, withRace } from "./test/techRace.ts";

/** The answer `value` to the decision `state` has open. */
function answer(state: GameState, value: AnswerValue): Answer {
  const d = state.public.pending[0];
  if (d === undefined) throw new Error("nothing pending");
  return { decisionId: d.id, side: d.side, value };
}

/** Both normal plays of the first turn (one each), LIO's l3 and SAE's s2 for their events, with the marker at `marker`. */
function afterNormalPlays(marker: number, rules: Ruleset = raceRules): GameState {
  const lio = applied(raceGame({ marker }), playAnswer(raceGame({ marker }), "lio", "l3", "event"), rules).state;
  return applied(lio, playAnswer(lio, "sae", "s2", "event"), rules).state;
}

const pass: AnswerValue = { kind: "pass" };

describe("Hypersonics: one extra play at the end of each turn", () => {
  it("is offered to the holder after both sides have made all their normal plays", () => {
    const state = afterNormalPlays(-3);
    expect(state.public.pending).toMatchObject([{ kind: "extraPlay", side: "lio" }]);
    expect(state.public.techRace?.extraPlay).toBe("lio");
    expect(state.public.turnEndFired).toBe(false);
  });

  it("is offered at Quantum Computing too, and to SAE when it holds the step", () => {
    expect(afterNormalPlays(-4).public.pending).toMatchObject([{ kind: "extraPlay", side: "lio" }]);
    expect(afterNormalPlays(3).public.pending).toMatchObject([{ kind: "extraPlay", side: "sae" }]);
  });

  it("is not offered below Hypersonics or at parity: the turn ends", () => {
    for (const marker of [-2, 0, 2]) {
      const state = afterNormalPlays(marker);
      expect(state.public.turn).toBe(2);
      expect(state.public.pending.every((d) => d.kind === "chooseCard")).toBe(true);
    }
  });

  it("allows every play the hand allows, and passing, last", () => {
    const state = afterNormalPlays(-3);
    const legal = legalAnswers(raceRules, state, "lio");
    expect(legal.at(-1)).toEqual(pass);
    expect(legal.slice(0, -1)).toEqual(
      state.private.lio.hand.flatMap((card): AnswerValue[] =>
        card.startsWith("s")
          ? [{ kind: "playCardAs", card, as: "points" }]
          : [
              { kind: "playCardAs", card, as: "event" },
              { kind: "playCardAs", card, as: "points" },
            ],
      ),
    );
    expect(legalAnswers(raceRules, state, "sae")).toEqual([]);
  });

  it("is optional: passing ends the turn, and the next turn starts with no extra play recorded", () => {
    const state = afterNormalPlays(-3);
    const next = applied(state, answer(state, pass), raceRules).state;
    expect(next.public.turn).toBe(2);
    expect(next.public.pending.every((d) => d.kind === "chooseCard")).toBe(true);
    expect(next.public.techRace).not.toHaveProperty("extraPlay");
    expect(next.private.lio.hand).toEqual(expect.arrayContaining(state.private.lio.hand));
  });

  it("is an ordinary play: the card leaves the hand, is not counted as a normal play, and the turn then ends", () => {
    const state = afterNormalPlays(-3);
    const played = applied(state, answer(state, { kind: "playCardAs", card: "l4", as: "event" }), raceRules);
    expect(played.state.public.turn).toBe(2);
    expect(played.state.public.discard).toContain("l4");
    expect(played.state.public.pending.every((d) => d.kind === "chooseCard")).toBe(true);
  });

  it("is offered once a turn: after it, no further play is asked for", () => {
    const state = afterNormalPlays(-3);
    const points = applied(state, answer(state, { kind: "playCardAs", card: "l2", as: "points" }), raceRules).state;
    expect(points.public.playsMade).toBe(2);
    expect(points.public.techRace?.extraPlay).toBe("lio");
    let placed = applied(points, choose(points, { kind: "chooseAction", action: "place" }), raceRules).state;
    while (placed.public.pending[0]?.kind === "placeInfluence") {
      const first = legalAnswers(raceRules, placed, "lio")[0]!;
      placed = applied(placed, answer(placed, first), raceRules).state;
    }
    expect(placed.public.turn).toBe(2);
    expect(placed.public.pending.every((d) => d.kind === "chooseCard")).toBe(true);
  });

  it("is not offered when the holder's hand is empty", () => {
    const lio = applied(
      raceGame({ marker: -3 }),
      playAnswer(raceGame({ marker: -3 }), "lio", "l3", "event"),
      raceRules,
    ).state;
    const empty = { ...lio, private: { ...lio.private, lio: { ...lio.private.lio, hand: [] } } };
    const state = applied(empty, playAnswer(empty, "sae", "s2", "event"), raceRules).state;
    expect(state.public.turn).toBe(2);
  });
});

describe("a timeout during the extra play", () => {
  it("is a loss on time for the holder, the side waited for", () => {
    const r = apply(raceRules, afterNormalPlays(-3), { system: "timeout", side: "lio" });
    expect(r.ok && r.value.state.public.status).toEqual({ kind: "over", winner: "sae", reason: "timeout" });
  });

  it("is refused for the rival, which nothing waits on", () => {
    const r = apply(raceRules, afterNormalPlays(-3), { system: "timeout", side: "sae" });
    expect(r.ok ? "ok" : r.error.code).toBe("wrongSide");
  });
});

describe("the extra play and the tech race", () => {
  /** The action menu of an extra play of l2 for its points, after `attempted` have made their attempt. */
  function extraMenu(attempted: Side[]): string[] | null {
    const state = withRace(afterNormalPlays(-3), { attempted });
    return menu(applied(state, answer(state, { kind: "playCardAs", card: "l2", as: "points" }), raceRules).state);
  }

  it("allows an attempt when the holder has not made its one attempt this turn", () => {
    expect(extraMenu([])).toContain("techRace");
    expect(extraMenu(["sae"])).toContain("techRace");
  });

  it("allows no attempt when the holder has already made it this turn", () => {
    expect(extraMenu(["lio"])).not.toContain("techRace");
  });
});

describe("the extra play's cardPlayed hook", () => {
  // SAE's s2 sets a trigger that marks each later play by LIO this turn.
  const watch: Step = {
    op: "trigger",
    hook: "cardPlayed",
    filter: { op: "playedBy", side: "lio" },
    do: [marker("lio-played")],
    duration: { kind: "turnEnd" },
  };
  const rules: Ruleset = {
    ...raceRules,
    cards: raceRules.cards.map((c) => (c.id === "s2" ? { ...c, effect: [watch] } : c)),
  };

  it("names the holder as the card's player, though SAE made the last normal play", () => {
    const state = afterNormalPlays(-3, rules);
    const { events } = applied(state, answer(state, { kind: "playCardAs", card: "l4", as: "event" }), rules);
    expect(events).toContainEqual(expect.objectContaining({ kind: "marker", label: "lio-played" }));
  });
});
