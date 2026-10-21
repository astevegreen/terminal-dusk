// Golden replay of refilling hands (docs/design/core-loop.md, "Refilling hands"). A fixed game whose turn 1
// refill deals both hands, whose turn 2 refill draws from what is left, and whose turn 3 refill runs the draw
// pile out and shuffles the discard pile into a new one. Each step saves only what a spectator sees: its
// events, the hand and draw pile counts, the discard pile and the turn. Never the answers, hidden cards or seed.
// Re-record it with `pnpm golden:update`, and only for an intended rules change.
import { apply, createGame, eventsFor, legalAnswers, seedHash, viewFor } from "@terminal-dusk/engine";
import type { CardDef, GameEvent, GameState, Ruleset, Setup } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";

const SEED = "golden-refill";
/** Cards with no effect, so the replay changes only when the rules do, never with the content. */
const card = (id: string, affiliation: CardDef["affiliation"]): CardDef => ({
  id,
  era: "golden",
  ops: 1,
  affiliation,
  effect: [],
});
const RULESET: Ruleset = {
  id: "golden-ruleset",
  cards: [
    ...["l1", "l2", "l3", "l4", "l5", "l6"].map((id) => card(id, "lio")),
    ...["s1", "s2", "s3", "s4", "s5", "s6"].map((id) => card(id, "sae")),
  ],
};
/** Hands of 3 from a draw pile of 10: 6 dealt on turn 1, 4 drawn on turn 2, none left for turn 3. */
const SETUP: Setup = {
  seedHash: seedHash(SEED),
  hands: { lio: [], sae: [] },
  deck: ["l1", "l2", "l3", "l4", "l5", "s1", "s2", "s3", "s4", "s5"],
  turns: 3,
  playsPerTurn: 1,
  handSize: 3,
  contingency: { lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6], world: [1, 2, 3, 4, 5, 6] },
};

/** What a spectator sees after one step. */
function seen(state: GameState, events: readonly GameEvent[]) {
  const view = viewFor(state, "spectator");
  return {
    turn: view.public.turn,
    events: eventsFor(events, "spectator"),
    counts: view.counts,
    discard: view.public.discard,
  };
}

/** Plays the game to its end, each open decision getting its first legal answer, and returns every step. */
function replay() {
  const created = createGame(RULESET, SETUP, SEED);
  if (!created.ok) throw new Error(`createGame failed: ${created.error.code}`);
  let state = created.value.state;
  const steps = [seen(state, created.value.events)];
  while (state.public.status.kind === "active") {
    const decision = state.public.pending[0];
    if (decision === undefined) throw new Error("the game is active but waits for no one");
    const value = legalAnswers(RULESET, state, decision.side)[0];
    if (value === undefined) throw new Error(`no legal answer for ${decision.id}`);
    const next = apply(RULESET, state, { decisionId: decision.id, side: decision.side, value });
    if (!next.ok) throw new Error(`answer refused: ${next.error.code}`);
    state = next.value.state;
    steps.push(seen(state, next.value.events));
  }
  return { steps, status: state.public.status };
}

describe("golden replay: refilling hands", () => {
  it("deals, refills and reshuffles exactly as recorded", () => {
    expect(replay()).toMatchSnapshot();
  });
  it("runs the draw pile out on turn 3 and shuffles the discard pile into a new one, once", () => {
    const { steps } = replay();
    const reshuffles = steps.flatMap((step) => step.events.filter((event) => event.kind === "drawPileReshuffled"));
    expect(reshuffles).toHaveLength(1);
    expect(steps.find((step) => step.events.includes(reshuffles[0]!))?.turn).toBe(3);
  });
});
