// The omniscient viewer: everything except the secret compartment, for replays of finished games.
import { describe, expect, expectTypeOf, it } from "vitest";
import { apply, eventsFor, viewFor } from "./index.ts";
import type { GameEvent, GameState, OmniscientView, PlayerView, ReplayViewer, Viewer } from "./index.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { playAnswers, ruleset, startGame } from "./test/game.ts";
import { byCodeUnit } from "./test/sort.ts";

function finishedGame(): GameState {
  const r = apply(ruleset, playAnswers(startGame(), 1), { system: "resign", side: "lio" });
  if (!r.ok) throw new Error(`resign failed: ${r.error.code}`);
  return r.value.state;
}

const lioDrew: GameEvent = {
  kind: "cardDrawn",
  visibility: "lio",
  side: "lio",
  card: "secret-card-77",
  publicForm: { kind: "cardDrawnHidden", visibility: "public", side: "lio" },
};
const saeDrew: GameEvent = {
  kind: "cardDrawn",
  visibility: "sae",
  side: "sae",
  card: "secret-card-88",
  publicForm: { kind: "cardDrawnHidden", visibility: "public", side: "sae" },
};
const marked: GameEvent = { kind: "marker", visibility: "public", label: "m" };

describe("viewFor(state, 'omniscient')", () => {
  it("holds both hands exactly as the state does, plus the same public compartment, counts and meta as lio's view, in progress and finished", () => {
    const finished = finishedGame();
    expect(finished.public.status.kind).toBe("over");
    for (const s of [startGame(), playAnswers(startGame(), 1), finished]) {
      const view = viewFor(s, "omniscient");
      const lio = viewFor(s, "lio");
      expect(view.sides).toEqual(s.private);
      expect(view.sides.lio.hand).toEqual(s.private.lio.hand);
      expect(view.sides.sae.hand).toEqual(s.private.sae.hand);
      expect(view.public).toEqual(lio.public);
      expect(view.counts).toEqual(lio.counts);
      expect(view.meta).toEqual(lio.meta);
    }
  });
  it("has no secret key, and its JSON contains neither the generator state nor any draw-pile card id", () => {
    const s = startGame();
    const view = viewFor(s, "omniscient");
    expect(Object.keys(view).toSorted(byCodeUnit)).toEqual(["counts", "meta", "public", "sides"]);
    expect("secret" in view).toBe(false);
    const json = JSON.stringify(view);
    expect(json).not.toContain('"rng"');
    expect(s.secret.deck.length).toBeGreaterThan(0);
    for (const card of s.secret.deck) expect(json).not.toContain(`"${card}"`);
    // Words below 2^16 cannot be told apart from small game counters (as in views.property.test.ts).
    for (const word of s.secret.rng.filter((w) => w >= 65536)) expect(json).not.toContain(String(word));
  });
  it("changing the view does not change the state", () => {
    const s = deepFreeze(startGame());
    const before = JSON.stringify(s);
    const view = viewFor(s, "omniscient");
    view.sides.lio.hand.push("extra");
    view.sides.sae.hand.length = 0;
    view.public.discard.push("extra");
    view.counts.hands.lio = 99;
    view.meta.seq = 99;
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe("eventsFor(events, 'omniscient')", () => {
  it("keeps every event, including those seen by only one side, in their full form and order", () => {
    const all = [lioDrew, marked, saeDrew];
    const seen = eventsFor(all, "omniscient");
    expect(seen).toEqual(all);
    expect(seen.map((e) => e.kind)).toEqual(["cardDrawn", "marker", "cardDrawn"]);
    expect(JSON.stringify(seen)).toContain('"secret-card-77"');
    expect(JSON.stringify(seen)).toContain('"secret-card-88"');
  });
});

describe("omniscient types", () => {
  it("viewFor returns an OmniscientView for 'omniscient' and a PlayerView for the live viewers", () => {
    const s = startGame();
    expectTypeOf(viewFor(s, "omniscient")).toEqualTypeOf<OmniscientView>();
    expectTypeOf(viewFor(s, "lio")).toEqualTypeOf<PlayerView>();
    expectTypeOf(viewFor(s, "spectator")).toEqualTypeOf<PlayerView>();
  });
  it("a viewer typed as the whole ReplayViewer union compiles with viewFor and eventsFor", () => {
    const viewers: ReplayViewer[] = ["lio", "sae", "spectator", "omniscient"];
    for (const viewer of viewers) {
      expectTypeOf(viewFor(startGame(), viewer)).toEqualTypeOf<PlayerView | OmniscientView>();
      expect(Array.isArray(eventsFor([marked], viewer))).toBe(true);
    }
  });
  it("an OmniscientView cannot be used where a PlayerView is expected, and Viewer excludes 'omniscient'", () => {
    const omniscient = viewFor(startGame(), "omniscient");
    // @ts-expect-error: an omniscient view is not a live frame's PlayerView.
    const asPlayer: PlayerView = omniscient;
    expect(asPlayer).toBeDefined();
    // @ts-expect-error: Viewer holds only the live viewers.
    const live: Viewer = "omniscient";
    expect(live).toBe("omniscient");
  });
});
