// #602: SAE's Unified command (docs/design/sides.md, "Asymmetry"). After SAE plays one of its own cards for its
// event, the next card SAE plays for its points in the same turn counts 1 more (the scenario's bonus). Opening
// cards never set it up; it resets at turn end; a card's own spendPoints step is not a card played for points.
import { describe, expect, it } from "vitest";
import { createGame } from "./index.ts";
import type { AbilityState, CardId, GameEvent, GameState, Ruleset, Setup, SideAbility } from "./index.ts";
import { rulesetError } from "./cardChecks.ts";
import { accepted, applied, makeSetup, orderAnswer, playAnswer, playAnswers, ruleset, sideCard } from "./test/game.ts";
import { withCards } from "./test/game.ts";

const ABILITIES: Record<"lio" | "sae", SideAbility> = {
  lio: { id: "resilientInstitutions", perTurn: 1 },
  sae: { id: "unifiedCommand", bonus: 1 },
};

/** A game with the abilities, at LIO's first play after the openings (l1 and s1). */
function start(playsPerTurn = 2, rs: Ruleset = ruleset, extra: { sae?: CardId[] } = {}, bonus = 1): GameState {
  const base = makeSetup(2, playsPerTurn);
  const setup: Setup = {
    ...base,
    hands: { ...base.hands, sae: [...base.hands.sae, ...(extra.sae ?? [])] },
    abilities: { ...ABILITIES, sae: { id: "unifiedCommand", bonus } },
  };
  const r = createGame(rs, setup, "seed-1");
  if (!r.ok) throw new Error(`createGame failed: ${r.error.message}`);
  return playAnswers(r.value.state, 2, rs);
}

const spent = (events: readonly GameEvent[]) => events.flatMap((e) => (e.kind === "pointsSpent" ? [e.amount] : []));
const command = (state: GameState) => state.public.abilities!.sae as Extract<AbilityState, { id: "unifiedCommand" }>;

describe("Unified command", () => {
  it("starts not ready and unused, and an SAE opening card's event does not set it up", () => {
    expect(command(start())).toEqual({ id: "unifiedCommand", bonus: 1, ready: false, used: 0 });
  });

  it("an SAE card played for its event makes the next SAE card played for points count 1 more", () => {
    // Three plays a turn, so SAE's second play is not the turn's last, whose end would reset the count.
    let s = accepted(start(3), playAnswer(start(3), "lio", "l2", "points"));
    const ready = applied(s, playAnswer(s, "sae", "s2", "event"));
    expect(ready.events).toContainEqual({ kind: "abilityReady", visibility: "public", side: "sae" });
    expect(command(ready.state).ready).toBe(true);
    s = accepted(ready.state, playAnswer(ready.state, "lio", "l3", "points"));
    const paid = applied(s, playAnswer(s, "sae", "s3", "points"));
    expect(spent(paid.events)).toEqual([2]);
    expect(paid.events).toContainEqual({ kind: "abilityBonus", visibility: "public", side: "sae", amount: 1 });
    expect(command(paid.state)).toEqual({ id: "unifiedCommand", bonus: 1, ready: false, used: 1 });
  });

  it("the bonus is the scenario's number, not a fixed 1", () => {
    let s = start(2, ruleset, {}, 3);
    s = accepted(s, playAnswer(s, "lio", "l2", "points"));
    s = accepted(s, playAnswer(s, "sae", "s2", "event"));
    s = accepted(s, playAnswer(s, "lio", "l3", "points"));
    expect(spent(applied(s, playAnswer(s, "sae", "s3", "points")).events)).toEqual([4]);
  });

  it("a neutral card played for its event does not set it up", () => {
    let s = accepted(start(), playAnswer(start(), "lio", "l2", "points"));
    s = accepted(s, playAnswer(s, "sae", "n2", "event"));
    expect(command(s).ready).toBe(false);
    s = accepted(s, playAnswer(s, "lio", "l3", "points"));
    expect(spent(applied(s, playAnswer(s, "sae", "s3", "points")).events)).toEqual([1]);
  });

  it("an LIO card SAE plays for points collects it, its event before or after the points", () => {
    for (const order of ["before", "after"] as const) {
      let s = start(2, ruleset, { sae: ["l12"] });
      s = accepted(s, playAnswer(s, "lio", "l2", "points"));
      s = accepted(s, playAnswer(s, "sae", "s2", "event"));
      s = accepted(s, playAnswer(s, "lio", "l3", "points"));
      s = accepted(s, playAnswer(s, "sae", "l12", "points"));
      expect(spent(applied(s, orderAnswer(s, "sae", order)).events)).toEqual([2]);
    }
  });

  it("a spendPoints step in a card's event is not a card played for points and leaves it ready", () => {
    const rs = withCards(sideCard("s3", 1, [{ op: "spendPoints", side: "sae", amount: 2 }]));
    let s = start(3, rs);
    s = accepted(s, playAnswer(s, "lio", "l2", "points"), rs);
    s = accepted(s, playAnswer(s, "sae", "s2", "event"), rs);
    s = accepted(s, playAnswer(s, "lio", "l3", "points"), rs);
    const played = applied(s, playAnswer(s, "sae", "s3", "event"), rs);
    expect(spent(played.events)).toEqual([2]);
    expect(command(played.state)).toMatchObject({ ready: true, used: 0 });
  });

  it("works once per event: a second play for points gets no bonus", () => {
    let s = start(3);
    s = accepted(s, playAnswer(s, "lio", "l2", "points"));
    s = accepted(s, playAnswer(s, "sae", "s2", "event"));
    s = accepted(s, playAnswer(s, "lio", "l3", "points"));
    s = accepted(s, playAnswer(s, "sae", "s3", "points"));
    s = accepted(s, playAnswer(s, "lio", "l4", "points"));
    expect(spent(applied(s, playAnswer(s, "sae", "s4", "points")).events)).toEqual([1]);
  });

  it("a ready that is not collected ends with the turn, and both abilities' counts reset", () => {
    let s = start(1);
    s.public.abilities!.lio = { id: "resilientInstitutions", perTurn: 1, used: 1 };
    s = accepted(s, playAnswer(s, "lio", "l2", "points"));
    s = accepted(s, playAnswer(s, "sae", "s2", "event"));
    expect(s.public.turn).toBe(2);
    expect(command(s)).toEqual({ id: "unifiedCommand", bonus: 1, ready: false, used: 0 });
    expect(s.public.abilities!.lio).toEqual({ id: "resilientInstitutions", perTurn: 1, used: 0 });
  });

  it("a game whose setup names no abilities has none, and plays for points count as printed", () => {
    const r = createGame(ruleset, makeSetup(2, 2), "seed-1");
    if (!r.ok) throw new Error("createGame failed");
    expect(r.value.state.public.abilities).toBeUndefined();
  });

  it("card data may not mark a spendPoints as a card played for points (cardPoints)", () => {
    const bad = withCards(
      sideCard("s3", 1, [{ op: "spendPoints", side: "sae", amount: 1, cardPoints: true } as never]),
    );
    expect(rulesetError(bad)).not.toBeNull();
  });
});

describe("the setup's abilities", () => {
  const withAbilities = (abilities: unknown) => ({ ...makeSetup(), abilities }) as Setup;
  it.each([
    ["an unknown ability", { ...ABILITIES, sae: { id: "nope", bonus: 1 } }],
    ["a bonus of 0", { ...ABILITIES, sae: { id: "unifiedCommand", bonus: 0 } }],
    ["a fractional perTurn", { ...ABILITIES, lio: { id: "resilientInstitutions", perTurn: 1.5 } }],
    ["a missing side", { lio: ABILITIES.lio }],
    ["not an object", 3],
  ])("refuses %s", (_name, abilities) => {
    const r = createGame(ruleset, withAbilities(abilities), "seed-1");
    expect(r.ok ? null : r.error.code).toBe("invalidSetup");
  });
});
