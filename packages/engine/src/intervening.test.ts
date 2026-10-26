// R16b (#316): intervene on the action menu (docs/design/map-and-points.md, "Points and actions" 1 and 2). All of a
// play's points go to one action (owner, 26 Oct, #316: they cannot be split). Intervening picks a country where the
// rival has influence, draws one card from the side's own Contingency deck, and the result is draw + points - 2 x
// stability (owner, 26 Oct, #316 option a). Built on the test map (test/map.ts): LIO starts with 2 in alpha and 1 in
// charlie, SAE with 3 in echo and 1 in charlie; stabilities alpha 2, bravo 1, charlie 3, delta 2, echo 1, foxtrot 1.
import { describe, expect, it } from "vitest";
import { apply, legalAnswers } from "./index.ts";
import type { AnswerValue, CountryId, GameEvent, GameState, Side, Step } from "./index.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import {
  accepted,
  applied,
  playAnswer,
  playAnswers,
  ruleset,
  sideCard,
  startGame,
  startWith,
  withCards,
} from "./test/game.ts";
import { mapSetup } from "./test/map.ts";

const spend = (side: Side, amount: number): Step => ({ op: "spendPoints", side, amount });

/** A map game at LIO's first play, with influence from `counts` (0 where none is given), or the map's start. */
function mapGame(counts?: Record<CountryId, { lio?: number; sae?: number }>): GameState {
  const state = playAnswers(startGame(2, 1, ruleset, mapSetup()), 2);
  if (counts === undefined) return state;
  const influence = state.public.influence!.map(({ country }) => ({
    country,
    lio: counts[country]?.lio ?? 0,
    sae: counts[country]?.sae ?? 0,
  }));
  return { ...state, public: { ...state.public, influence } };
}

/** `state` with `side`'s next Contingency draw set to `value` (the deck keeps the same cards). */
function nextDraw(state: GameState, side: Side, value: number): GameState {
  const order = state.secret.contingency[side];
  const at = order.indexOf(value);
  if (at < 0) throw new Error(`${side}'s deck has no ${value} left`);
  const reordered = [value, ...order.slice(0, at), ...order.slice(at + 1)];
  return { ...state, secret: { ...state.secret, contingency: { ...state.secret.contingency, [side]: reordered } } };
}

const countOf = (state: GameState, country: CountryId, side: Side): number =>
  state.public.influence!.find((e) => e.country === country)![side];

/** The answer to the action choice `state` has open. */
function choose(state: GameState, value: AnswerValue) {
  const d = state.public.pending[0];
  if (d?.kind !== "chooseAction") throw new Error(`no action choice pending: ${JSON.stringify(state.public.pending)}`);
  return { decisionId: d.id, side: d.side, value };
}
const placeAction: AnswerValue = { kind: "chooseAction", action: "place" };
const interveneIn = (country: CountryId): AnswerValue => ({ kind: "chooseAction", action: "intervene", country });

const intervened = (events: readonly GameEvent[]) => events.filter((e) => e.kind === "intervened");

/** `side` spends `points` and intervenes in `country`, its next draw being `draw`. */
function interveneWith(start: GameState, side: Side, points: number, country: CountryId, draw: number) {
  const asked = startWith([spend(side, points)], ruleset, nextDraw(start, side, draw)).state;
  return applied(asked, choose(asked, interveneIn(country)));
}

describe("the action menu: placing or intervening (R16b)", () => {
  it("asks the side to pick one action for all its points, offering an intervention where the rival has influence", () => {
    const { state } = startWith([spend("lio", 2)], ruleset, mapGame());
    expect(state.public.pending).toEqual([
      {
        id: expect.any(String),
        side: "lio",
        kind: "chooseAction",
        options: { points: 2, targets: ["charlie", "echo"] },
      },
    ]);
    expect(legalAnswers(ruleset, state, "lio")).toEqual([placeAction, interveneIn("charlie"), interveneIn("echo")]);
    expect(legalAnswers(ruleset, state, "sae")).toEqual([]);
  });

  it("picking place spends all the points on placing influence, as before", () => {
    const asked = startWith([spend("lio", 2)], ruleset, mapGame()).state;
    const placing = accepted(asked, choose(asked, placeAction));
    expect(placing.public.pending[0]).toMatchObject({
      side: "lio",
      kind: "placeInfluence",
      options: { points: 2, countries: ["alpha", "bravo", "charlie", "delta"] },
    });
    expect(legalAnswers(ruleset, placing, "lio").every((a) => a.kind === "placeInfluence")).toBe(true);
  });

  it("with no rival influence anywhere, the side goes straight to placing", () => {
    const { state } = startWith([spend("lio", 2)], ruleset, mapGame({ alpha: { lio: 2 } }));
    expect(state.public.pending[0]).toMatchObject({ kind: "placeInfluence", options: { points: 2 } });
  });

  it("does not need adjacency: a country out of the side's reach can take an intervention", () => {
    const { state } = startWith([spend("lio", 1)], ruleset, mapGame({ alpha: { lio: 1 }, foxtrot: { sae: 1 } }));
    expect(state.public.pending[0]).toMatchObject({ kind: "chooseAction", options: { targets: ["foxtrot"] } });
    expect(legalAnswers(ruleset, state, "lio")).toContainEqual(interveneIn("foxtrot"));
  });

  it("offers only interventions when no placement is affordable, and refuses place", () => {
    // SAE controls alpha (stability 2) with 2, LIO's only reach: 1 point cannot buy an influence there.
    const { state } = startWith([spend("lio", 1)], ruleset, mapGame({ alpha: { sae: 2 } }));
    expect(legalAnswers(ruleset, state, "lio")).toEqual([interveneIn("alpha")]);
    const refused = apply(ruleset, state, choose(state, placeAction));
    expect(refused.ok ? "accepted" : refused.error.code).toBe("illegalAnswer");
  });

  it("refuses an intervention in a country where the rival has no influence, or not on the map", () => {
    const { state } = startWith([spend("lio", 2)], ruleset, mapGame());
    for (const country of ["alpha", "bravo", "nowhere"]) {
      const r = apply(ruleset, state, choose(state, interveneIn(country)));
      expect(r.ok ? "accepted" : r.error.code).toBe("illegalAnswer");
    }
  });

  it("offers no intervention in a region Escalation has closed", () => {
    // At Escalation 3 the test map's south (delta, echo) is closed.
    const start = mapGame();
    const at3 = { ...start, public: { ...start.public, escalation: 3 } };
    const { state } = startWith([spend("lio", 2)], ruleset, at3);
    expect(state.public.pending[0]).toMatchObject({ kind: "chooseAction", options: { targets: ["charlie"] } });
    const r = apply(ruleset, state, choose(state, interveneIn("echo")));
    expect(r.ok ? "accepted" : r.error.code).toBe("illegalAnswer");
  });

  it("with 0 points to spend, nobody is asked", () => {
    const { state, events } = startWith([spend("lio", 0), { op: "marker", label: "after" }], ruleset, mapGame());
    expect(events.map((e) => e.kind)).toEqual(["pointsSpent", "marker"]);
    expect(state.public.stack).toEqual([]);
  });
});

describe("an intervention (R16b)", () => {
  it("result = draw + points - 2 x stability: rival influence comes off first, the rest goes on as the side's own", () => {
    // Echo: stability 1, SAE 3. Draw 4 + 2 points - 2 = 4: SAE loses all 3, LIO gains 1.
    const { state, events } = interveneWith(mapGame(), "lio", 2, "echo", 4);
    expect(intervened(events)).toEqual([
      {
        kind: "intervened",
        visibility: "public",
        side: "lio",
        country: "echo",
        stability: 1,
        points: 2,
        draw: 4,
        result: 4,
        removed: 3,
        added: 1,
      },
    ]);
    expect(countOf(state, "echo", "sae")).toBe(0);
    expect(countOf(state, "echo", "lio")).toBe(1);
  });

  it("a result smaller than the rival's influence only removes that much", () => {
    // Echo: draw 2 + 1 point - 2 = 1: SAE goes from 3 to 2, LIO gains nothing.
    const { state, events } = interveneWith(mapGame(), "lio", 1, "echo", 2);
    expect(intervened(events)[0]).toMatchObject({ result: 1, removed: 1, added: 0 });
    expect(countOf(state, "echo", "sae")).toBe(2);
    expect(countOf(state, "echo", "lio")).toBe(0);
  });

  it("a result of 0 or less changes no influence, but the draw is used up", () => {
    // Charlie: stability 3. Draw 1 + 1 point - 6 = -4.
    const start = mapGame();
    const { state, events } = interveneWith(start, "lio", 1, "charlie", 1);
    expect(intervened(events)[0]).toMatchObject({ draw: 1, result: -4, removed: 0, added: 0 });
    expect(state.public.influence).toEqual(start.public.influence);
    expect(state.public.contingency.lio.left).toEqual([2, 3, 4, 5, 6]);
  });

  it("draws one card from the acting side's own Contingency deck, for everyone to see", () => {
    const lio = interveneWith(mapGame(), "lio", 1, "echo", 5);
    expect(lio.events.filter((e) => e.kind === "contingencyDrawn")).toEqual([
      { kind: "contingencyDrawn", visibility: "public", deck: "lio", value: 5 },
    ]);
    const sae = interveneWith(mapGame(), "sae", 1, "alpha", 3);
    expect(sae.events.filter((e) => e.kind === "contingencyDrawn")).toEqual([
      { kind: "contingencyDrawn", visibility: "public", deck: "sae", value: 3 },
    ]);
    // Alpha: stability 2, LIO 2. Draw 3 + 1 - 4 = 0: nothing changes.
    expect(intervened(sae.events)[0]).toMatchObject({ side: "sae", country: "alpha", result: 0 });
  });

  it("uses all the points: points cannot be split, so the play ends with no placing after it", () => {
    const { state, events } = interveneWith(mapGame(), "lio", 3, "echo", 6);
    expect(intervened(events)[0]).toMatchObject({ points: 3 });
    expect(events.some((e) => e.kind === "influencePlaced")).toBe(false);
    expect(state.public.stack).toEqual([]);
    expect(state.public.pending.some((d) => d.kind === "placeInfluence" || d.kind === "chooseAction")).toBe(false);
  });

  it("an event giving both sides points asks each side in turn, after the first side's intervention", () => {
    const start = nextDraw(mapGame(), "lio", 6);
    const first = startWith([spend("lio", 1), spend("sae", 1)], ruleset, start).state;
    const second = accepted(first, choose(first, interveneIn("charlie")));
    expect(second.public.pending[0]).toMatchObject({ side: "sae", kind: "chooseAction" });
  });

  it("never changes the state it is given (frozen input)", () => {
    const asked = deepFreeze(startWith([spend("lio", 2)], ruleset, nextDraw(mapGame(), "lio", 4)).state);
    const next = accepted(asked, choose(asked, interveneIn("echo")));
    expect(countOf(asked, "echo", "sae")).toBe(3);
    expect(countOf(next, "echo", "sae")).toBe(0);
  });
});

describe("a card played for its points can intervene (R16b)", () => {
  it("asks the player for the action, intervenes with the card's ops, then the game moves on to the next play", () => {
    const rs = withCards(sideCard("l3", 2));
    const atPlay = nextDraw(playAnswers(startGame(2, 1, rs, mapSetup()), 2, rs), "lio", 4);
    const asked = applied(atPlay, playAnswer(atPlay, "lio", "l3", "points"), rs);
    expect(asked.state.public.pending[0]).toMatchObject({ side: "lio", kind: "chooseAction", options: { points: 2 } });
    const done = applied(asked.state, choose(asked.state, interveneIn("echo")), rs);
    expect(intervened(done.events)[0]).toMatchObject({ points: 2, draw: 4, result: 4, removed: 3, added: 1 });
    expect(done.state.public.pending).toEqual([expect.objectContaining({ side: "sae", kind: "playCardAs" })]);
    expect(done.state.public.discard).toContain("l3");
  });
});
