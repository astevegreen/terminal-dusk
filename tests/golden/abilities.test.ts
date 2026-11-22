// Golden replay of the sides' special abilities (#602, docs/design/sides.md, "Asymmetry"). A fixed game with cards
// defined here: LIO's cards draw from LIO's own Contingency deck, which holds only 1s, so Resilient institutions sets
// the first 1 of each turn aside and the redraw, a 1 again, stands; SAE plays its own card for its event, so Unified
// command is ready, and its next card played for points collects the bonus. Each step saves only what a spectator
// sees: its events, the abilities, the points and the turn. Never the answers, hidden cards or seed.
// Re-record it with `pnpm golden:update`, and only for an intended rules change.
import { apply, createGame, eventsFor, legalAnswers, seedHash, viewFor } from "@terminal-dusk/engine";
import type { AnswerValue, CardDef, GameEvent, GameState, Ruleset, Setup, Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";

const SEED = "golden-abilities";
/** LIO's cards each draw once from LIO's deck; SAE's do nothing. Neither depends on the real content. */
const card = (id: string, affiliation: CardDef["affiliation"]): CardDef => ({
  id,
  era: "golden",
  ops: 2,
  affiliation,
  effect: affiliation === "lio" ? [{ op: "drawContingency", side: "lio" }] : [],
});
const RULESET: Ruleset = {
  id: "golden-abilities-ruleset",
  cards: [
    ...["l1", "l2", "l3", "l4", "l5", "l6"].map((id) => card(id, "lio")),
    ...["s1", "s2", "s3", "s4", "s5", "s6"].map((id) => card(id, "sae")),
  ],
};
const SETUP: Setup = {
  seedHash: seedHash(SEED),
  hands: { lio: ["l1", "l2", "l3"], sae: ["s1", "s2", "s3"] },
  deck: ["l4", "l5", "l6", "s4", "s5", "s6"],
  turns: 2,
  playsPerTurn: 2,
  handSize: 3,
  contingency: { lio: [1, 1, 1, 1, 1, 1], sae: [1, 2, 3, 4, 5, 6], world: [1, 2, 3, 4, 5, 6] },
  abilities: { lio: { id: "resilientInstitutions", perTurn: 1 }, sae: { id: "unifiedCommand", bonus: 1 } },
};

/** What a spectator sees after one step. */
function seen(state: GameState, events: readonly GameEvent[]) {
  const view = viewFor(state, "spectator");
  return { turn: view.public.turn, events: eventsFor(events, "spectator"), abilities: view.public.abilities };
}

type Play = Extract<AnswerValue, { kind: "playCardAs" }>;
/**
 * The answer `side` gives: a card play by a fixed plan (LIO: its own cards for the event; SAE: its own card for the
 * event, then, while Unified command is ready, a card for points), any other decision its first legal answer.
 */
function choose(state: GameState, side: Side): AnswerValue | undefined {
  const legal = legalAnswers(RULESET, state, side);
  const plays = legal.filter((a): a is Play => a.kind === "playCardAs");
  const ability = state.public.abilities?.[side];
  const forPoints = ability?.id === "unifiedCommand" && ability.ready;
  const wanted = plays.find((a) => (forPoints ? a.as === "points" : a.as === "event"));
  return wanted ?? legal[0];
}

/** Plays the game to its end and returns every step. */
function replay() {
  const created = createGame(RULESET, SETUP, SEED);
  if (!created.ok) throw new Error(`createGame failed: ${created.error.code}`);
  let state = created.value.state;
  const steps = [seen(state, created.value.events)];
  for (let n = 0; n < 500 && state.public.status.kind === "active"; n++) {
    const decision = state.public.pending[0];
    if (decision === undefined) throw new Error("the game is active but waits for no one");
    const value = choose(state, decision.side);
    if (value === undefined) throw new Error(`no legal answer for ${decision.id}`);
    const next = apply(RULESET, state, { decisionId: decision.id, side: decision.side, value });
    if (!next.ok) throw new Error(`answer refused: ${next.error.code}`);
    state = next.value.state;
    steps.push(seen(state, next.value.events));
  }
  return { steps, status: state.public.status };
}

const kinds = (steps: ReturnType<typeof replay>["steps"], kind: GameEvent["kind"]) =>
  steps.flatMap((step) => step.events.filter((event) => event.kind === kind).map(() => step.turn));

describe("golden replay: the special abilities", () => {
  it("redraws and pays the bonus exactly as recorded", () => {
    expect(replay()).toMatchSnapshot();
  });
  it("redraws once a turn for LIO, and readies and pays Unified command for SAE", () => {
    const { steps, status } = replay();
    expect(status.kind).toBe("over");
    expect(kinds(steps, "abilityRedraw")).toEqual([1, 2]);
    expect(kinds(steps, "abilityReady").length).toBeGreaterThan(0);
    expect(kinds(steps, "abilityBonus").length).toBeGreaterThan(0);
  });
});
