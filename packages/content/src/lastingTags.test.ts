// The lasting tags of the first deck (#202, owner 21 Oct): exactly the eight tags a later card reads are recorded
// for the rest of the game; every other marker stays a one-turn marker.
import { describe, expect, it } from "vitest";
import { FIRST_DECK_CARDS } from "./firstDeckRules.ts";

/** Every object inside `value` (a card's effect as plain JSON), at any depth, triggers and branches included. */
const objectsIn = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value.flatMap(objectsIn);
  if (value === null || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  return [object, ...Object.values(object).flatMap(objectsIn)];
};

const lastingTags = (): string[] =>
  FIRST_DECK_CARDS.flatMap((card) =>
    objectsIn(card.effect)
      .filter((step) => step.op === "marker" && step.lasting === true)
      .map((step) => `${card.id} ${String(step.label)}`),
  );

describe("the first deck's lasting tags", () => {
  it("are exactly the eight tags a later card reads, each set by its own card", () => {
    expect(lastingTags()).toEqual([
      "e1-lio-001 union founded",
      "e1-lio-002 hollow assurance",
      "e1-sae-001 intervention fatigue",
      "e1-sae-002 one country, two systems",
      "e2-sae-001 coalition fractures",
      "e2-neu-006 programme revealed",
      "e2-neu-007 precedent set",
      "e3-sae-008 proxy war",
    ]);
  });

  it("say so in their setting card's rules text", () => {
    for (const line of lastingTags()) {
      const [id] = line.split(" ");
      const label = line.slice(id!.length + 1);
      const card = FIRST_DECK_CARDS.find((c) => c.id === id)!;
      expect(card.text.rules.toLowerCase()).toContain(`record "${label}" for the rest of the game`);
    }
  });
});
