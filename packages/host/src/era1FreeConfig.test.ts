// The free player's game as the host hands it to the app (L12, #575): Era 1's cards only, 3 turns, no later era.
import { ERA_1_CARDS, ERA_1_FREE_SCENARIO } from "@terminal-dusk/content/first-deck";
import { describe, expect, it } from "vitest";
import { ERA_1_FREE_NOTE, era1FreeConfig, firstDeckConfig } from "./firstDeck.ts";

describe("era1FreeConfig", () => {
  it("is 3 turns of 2 plays with hands of 8, as the free scenario says", () => {
    const { setup } = era1FreeConfig();
    expect(setup.turns).toBe(3);
    expect(setup.turns).toBe(ERA_1_FREE_SCENARIO.turns);
    expect(setup.playsPerTurn).toBe(ERA_1_FREE_SCENARIO.playsPerTurn);
    expect(setup.handSize).toBe(ERA_1_FREE_SCENARIO.handSize);
  });
  it("draws only Era 1's cards, with empty hands and no later era entering", () => {
    const { setup } = era1FreeConfig();
    expect(setup.deck).toEqual(ERA_1_CARDS.map((c) => c.id));
    expect(setup.hands).toEqual({ lio: [], sae: [] });
    expect(setup.eras ?? []).toEqual([]);
    expect(firstDeckConfig().setup.eras?.length).toBeGreaterThan(0);
  });
  it("has its own match id, the same two players, and a note naming Era 1 and 3 turns", () => {
    expect(era1FreeConfig().matchId).toBe("era-1-free");
    expect(era1FreeConfig().players).toEqual(firstDeckConfig().players);
    expect(ERA_1_FREE_NOTE).toMatch(/Era 1/);
    expect(ERA_1_FREE_NOTE).toMatch(/3 turns/);
  });
  it("gives a fresh config each call", () => {
    expect(era1FreeConfig().setup.deck).not.toBe(era1FreeConfig().setup.deck);
  });
});
