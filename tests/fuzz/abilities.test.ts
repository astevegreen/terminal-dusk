// Tests for the special-ability checks (abilityChecks.ts, #602): random games of the 2025-2027 scenario, whose setup
// names both abilities, pass them while the abilities work; broken states and steps fail them.
import { FIRST_DECK_RULESET } from "@terminal-dusk/content/first-deck";
import { apply, createGame, seedHash } from "@terminal-dusk/engine";
import type { GameEvent, GameState, Setup } from "@terminal-dusk/engine";
import { scenario2025To2027Config } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import { checkAbilities, checkAbilityStep } from "./abilityChecks.ts";
import { randomChooser } from "./play.ts";
import { seededRng } from "./random.ts";

/** A deep copy: the state is plain JSON (hard rule 5). */
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const setupOf = (seed: string): Setup => ({ ...scenario2025To2027Config().setup, seedHash: seedHash(seed) });

/** A random game of the 2025-2027 scenario, with every step checked; returns the events of the whole game. */
function playChecked(game: number): GameEvent[] {
  const seed = `abilities-${game}`;
  const setup = setupOf(seed);
  const made = createGame(FIRST_DECK_RULESET, setup, seed);
  if (!made.ok) throw new Error(made.error.code);
  let { state } = made.value;
  const all: GameEvent[] = [...made.value.events];
  const choose = randomChooser(FIRST_DECK_RULESET, seededRng(game));
  checkAbilities(setup, state, made.value.events);
  for (let n = 0; n < 3000 && state.public.status.kind === "active"; n++) {
    const r = apply(FIRST_DECK_RULESET, state, choose(state)!);
    if (!r.ok) throw new Error(r.error.code);
    checkAbilities(setup, r.value.state, r.value.events);
    checkAbilityStep(state, r.value.events, r.value.state);
    state = r.value.state;
    all.push(...r.value.events);
  }
  return all;
}

/** The state createGame makes for the 2025-2027 scenario, as a fresh copy to break. */
function fresh(): { setup: Setup; state: GameState } {
  const setup = setupOf("abilities-fresh");
  const made = createGame(FIRST_DECK_RULESET, setup, "abilities-fresh");
  if (!made.ok) throw new Error(made.error.code);
  return { setup, state: copy(made.value.state) };
}

describe("the special-ability checks", () => {
  it("random 2025-2027 games pass them at every step, and both abilities work in them", () => {
    const events = [1, 2, 3, 4, 5, 6].flatMap(playChecked);
    expect(events.some((e) => e.kind === "abilityRedraw")).toBe(true);
    expect(events.some((e) => e.kind === "abilityReady")).toBe(true);
    expect(events.some((e) => e.kind === "abilityBonus")).toBe(true);
  }, 120_000);

  it("fail Resilient institutions used more than perTurn times", () => {
    const { setup, state } = fresh();
    const lio = state.public.abilities!.lio;
    if (lio.id !== "resilientInstitutions") throw new Error("LIO should have Resilient institutions");
    lio.used = lio.perTurn + 1;
    expect(() => checkAbilities(setup, state, [])).toThrow(/over/);
  });

  it("fail Unified command ready again after it was used", () => {
    const { setup, state } = fresh();
    const sae = state.public.abilities!.sae;
    if (sae.id !== "unifiedCommand") throw new Error("SAE should have Unified command");
    sae.ready = true;
    sae.used = 1;
    expect(() => checkAbilities(setup, state, [])).toThrow(/ready again/);
  });

  it("fail abilities in a game whose setup names none, and a number that is not the setup's", () => {
    const { setup, state } = fresh();
    const none = { ...setup };
    delete none.abilities;
    expect(() => checkAbilities(none, state, [])).toThrow(/names no abilities/);
    const sae = state.public.abilities!.sae;
    if (sae.id === "unifiedCommand") sae.bonus += 1;
    expect(() => checkAbilities(setup, state, [])).toThrow(/bonus/);
  });

  it("fail a redraw that sets aside a card other than a 1, or from the other side's deck", () => {
    const { setup, state } = fresh();
    const bad: GameEvent = { kind: "abilityRedraw", visibility: "public", side: "lio", deck: "sae", setAside: 1 };
    expect(() => checkAbilities(setup, state, [bad])).toThrow(/set aside/);
    expect(() => checkAbilities(setup, state, [{ ...bad, deck: "lio", setAside: 2 }])).toThrow(/set aside/);
  });

  it("fail a step whose use does not follow its events, and a new turn that keeps a ready command", () => {
    const { state: prior } = fresh();
    const after = copy(prior);
    after.public.abilities!.lio.used = 1;
    expect(() => checkAbilityStep(prior, [], after)).toThrow(/uses/);
    const next = copy(prior);
    next.public.turn += 1;
    const sae = next.public.abilities!.sae;
    if (sae.id === "unifiedCommand") sae.ready = true;
    expect(() => checkAbilityStep(prior, [], next)).toThrow(/still ready/);
  });
});
