// Views of a discardFromHand pick (#192): the pending discardCards decision is public and lists no card IDs,
// the picker's knowledge is in its own view only, and every view still rebuilds the whole state.
import { describe, expect, it } from "vitest";
import { apply } from "./apply.ts";
import { startProgram } from "./stack.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { ruleset, startAtPlay } from "./test/game.ts";
import { SIDES } from "./types.ts";
import type { GameState } from "./types.ts";
import { hiddenPart, reconstruct, viewFor } from "./views.ts";

/** Paused at SAE's discardFromHand of 2 cards, picked by LIO, the card's player, after seeing SAE's hand. */
function paused(): GameState {
  const r = startProgram(
    ruleset,
    startAtPlay(),
    [{ op: "discardFromHand", side: "sae", count: 2, chosenBy: "player" }],
    "n1",
    "lio",
  );
  if (!r.ok) throw new Error(r.error.code);
  return deepFreeze(r.value.state);
}

/** `paused()` after LIO discards SAE's first two cards. */
function answered(): GameState {
  const s = paused();
  const d = s.public.pending[0]!;
  const r = apply(ruleset, s, {
    decisionId: d.id,
    side: "lio",
    value: { kind: "discardCards", cards: s.private.sae.hand.slice(0, 2) },
  });
  if (!r.ok) throw new Error(r.error.code);
  return deepFreeze(r.value.state);
}

describe("views of a discardFromHand pick", () => {
  it("while paused, the pending decision is public and shows no card IDs", () => {
    const s = paused();
    const hand = s.private.sae.hand;
    for (const viewer of ["lio", "sae", "spectator"] as const) {
      const pending = viewFor(s, viewer).public.pending;
      expect(pending).toEqual(s.public.pending);
      const text = JSON.stringify(pending);
      for (const card of hand) expect(text).not.toContain(`"${card}"`);
    }
  });

  it("the picker's knowledge is in its own view only", () => {
    const s = paused();
    expect(viewFor(s, "lio").mine?.knowledge).toEqual(s.private.sae.hand);
    const seen = [JSON.stringify(viewFor(s, "sae")), JSON.stringify(viewFor(s, "spectator"))];
    for (const text of seen) expect(text).not.toContain('"knowledge":["');
  });

  it("reconstruct(viewFor(s, x), hiddenPart(s, x)) equals s for both sides, while paused and after the answer", () => {
    for (const s of [paused(), answered()]) {
      for (const side of SIDES) expect(reconstruct(viewFor(s, side), hiddenPart(s, side))).toStrictEqual(s);
    }
  });
});
