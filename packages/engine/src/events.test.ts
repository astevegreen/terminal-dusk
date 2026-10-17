import { describe, expect, it } from "vitest";
import { apply, createGame, eventsFor } from "./index.ts";
import type { GameEvent } from "./index.ts";
import { cardAnswer, makeSetup, playAnswers, ruleset, startAtPlay, startGame } from "./test/game.ts";

// Nothing draws cards yet, so these events are built by hand.
const lioDrew: GameEvent = {
  kind: "cardDrawn",
  visibility: "lio",
  side: "lio",
  card: "secret-card-77",
  publicForm: { kind: "cardDrawnHidden", visibility: "public", side: "lio" },
};
const saeDrewHidden: GameEvent = { kind: "cardDrawnHidden", visibility: "public", side: "sae" };
// Every real one-side event has a public form today; this stands in for a future kind that has none.
const saeOnlyNoPublicForm = {
  kind: "cardDrawn",
  visibility: "sae",
  side: "sae",
  card: "secret-card-88",
} as unknown as GameEvent;

describe("eventsFor", () => {
  it("LIO sees its own cardDrawn with the card ID", () => {
    expect(eventsFor([lioDrew], "lio")).toEqual([lioDrew]);
    expect(JSON.stringify(eventsFor([lioDrew], "lio"))).toContain('"secret-card-77"');
  });
  it("SAE and spectators see cardDrawnHidden, whose JSON contains no card ID", () => {
    for (const viewer of ["sae", "spectator"] as const) {
      const seen = eventsFor([lioDrew], viewer);
      expect(seen).toEqual([{ kind: "cardDrawnHidden", visibility: "public", side: "lio" }]);
      expect(JSON.stringify(seen)).not.toContain("secret-card-77");
    }
  });
  it("public events reach every viewer", () => {
    for (const viewer of ["lio", "sae", "spectator"] as const) {
      expect(eventsFor([saeDrewHidden], viewer)).toEqual([saeDrewHidden]);
    }
  });
  it("an event visible to one side, with no publicForm, reaches nobody else", () => {
    expect(eventsFor([saeOnlyNoPublicForm], "sae")).toEqual([saeOnlyNoPublicForm]);
    expect(eventsFor([saeOnlyNoPublicForm], "lio")).toEqual([]);
    expect(eventsFor([saeOnlyNoPublicForm], "spectator")).toEqual([]);
  });
  it("keeps the events in their original order", () => {
    const all = [lioDrew, saeDrewHidden, saeOnlyNoPublicForm];
    expect(eventsFor(all, "lio").map((e) => e.kind)).toEqual(["cardDrawn", "cardDrawnHidden"]);
    expect(eventsFor(all, "sae").map((e) => `${e.kind}:${"side" in e ? e.side : "none"}`)).toEqual([
      "cardDrawnHidden:lio",
      "cardDrawnHidden:sae",
      "cardDrawn:sae",
    ]);
  });
  it("does not change the list it is given", () => {
    const all = [lioDrew, saeDrewHidden];
    const before = JSON.stringify(all);
    eventsFor(all, "sae");
    expect(JSON.stringify(all)).toBe(before);
  });
});

describe("createGame and apply return their events", () => {
  it("createGame, the opening picks of cards with no effect, and a placeholder play emit no events, as an empty list", () => {
    const created = createGame(ruleset, makeSetup(), "seed-1");
    expect(created.ok && created.value.events).toEqual([]);
    for (const s of [startGame(), playAnswers(startGame(), 1), startAtPlay()]) {
      const applied = apply(ruleset, s, cardAnswer(s, s.public.pending[0]!.side));
      expect(applied.ok && applied.value.events).toEqual([]);
    }
  });
});
