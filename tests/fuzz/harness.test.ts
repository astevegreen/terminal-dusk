// Tests for the fuzz harness itself: each check catches what it should, so a green fuzz run means something.
import { apply, createGame, pendingFor, SIDES } from "@terminal-dusk/engine";
import type { Answer, GameEvent, GameState, Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { attempt, checkLive, checkNoLeaks, checkRebuilds, hiddenFrom, leaksIn } from "./checks.ts";
import { checkReplay, gameCount, playFuzzGame, playRecorded, randomGame, ruleset } from "./play.ts";
import type { GameRecord } from "./play.ts";
import { seededRng } from "./random.ts";

const SEED = "harness-seed";
const DECK = ["c4", "c5", "c6", "c7", "c8", "c9", "c10", "c11", "c12"];

/** A one-round game with known cards: LIO holds c1 and c2, SAE holds c3, the draw pile is c4 to c12. */
function started(): GameState {
  const r = createGame(
    ruleset,
    { seedHash: "hash", hands: { lio: ["c1", "c2"], sae: ["c3"] }, deck: DECK, rounds: 1 },
    SEED,
  );
  if (!r.ok) throw new Error(`createGame failed: ${r.error.code}`);
  return r.value.state;
}

/** For each answer given while both sides had a decision open, the side that answered. */
function firstAnswerers(record: GameRecord): Side[] {
  const r = createGame(ruleset, record.setup, record.seed);
  if (!r.ok) throw new Error(`createGame failed: ${r.error.code}`);
  let state = r.value.state;
  const sides: Side[] = [];
  for (const answer of record.answers) {
    if (SIDES.every((side) => pendingFor(state, side) !== null)) sides.push(answer.side);
    const next = apply(ruleset, state, answer);
    if (!next.ok) throw new Error(`apply failed: ${next.error.code}`);
    state = next.value.state;
  }
  return sides;
}

describe("how many games the suite plays", () => {
  it("plays FUZZ_GAMES games, and 100 when the variable is unset", () => {
    expect(gameCount(undefined)).toBe(100);
    expect(gameCount("")).toBe(100);
    expect(gameCount("1000")).toBe(1000);
    expect(() => gameCount("lots")).toThrow(/FUZZ_GAMES/);
    expect(() => gameCount("0")).toThrow(/FUZZ_GAMES/);
  });
});

describe("the suite's own seeded generator", () => {
  it("gives the same numbers for the same seed, and different ones for another seed", () => {
    const draw = (seed: number) => {
      const rng = seededRng(seed);
      return Array.from({ length: 20 }, () => rng.int(1000));
    };
    expect(draw(7)).toEqual(draw(7));
    expect(draw(7)).not.toEqual(draw(8));
  });

  it("picks every whole number below n, and nothing else", () => {
    const rng = seededRng(1);
    const seen = new Set(Array.from({ length: 300 }, () => rng.int(3)));
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });
});

describe("random games", () => {
  it("each game has its own seed, random starting hands and a random draw pile, with no card twice", () => {
    const games = Array.from({ length: 50 }, (_, i) => randomGame(seededRng(i + 1), i + 1));
    expect(new Set(games.map((g) => g.seed)).size).toBe(50);
    expect(new Set(games.map((g) => JSON.stringify(g.setup))).size).toBe(50);
    expect(games.filter((g) => g.setup.hands.lio.length > 0 && g.setup.hands.sae.length > 0).length).toBeGreaterThan(
      30,
    );
    expect(games.filter((g) => g.setup.deck.length > 0).length).toBeGreaterThan(40);
    for (const { setup } of games) {
      const cards = [...setup.hands.lio, ...setup.hands.sae, ...setup.deck];
      expect(new Set(cards).size).toBe(cards.length);
      expect(setup.rounds).toBeGreaterThanOrEqual(1);
    }
  });

  it("when both sides are waiting, the side that answers first is picked at random, so both orders get played", () => {
    const sides = Array.from({ length: 20 }, (_, i) => firstAnswerers(playFuzzGame(i + 1).record)).flat();
    expect(sides).toContain("lio");
    expect(sides).toContain("sae");
  });

  it("every state from createGame and apply is deep-frozen, and so is the ruleset", () => {
    const { final } = playFuzzGame(1);
    expect(Object.isFrozen(ruleset)).toBe(true);
    expect(Object.isFrozen(final)).toBe(true);
    expect(Object.isFrozen(final.public.status)).toBe(true);
    expect(Object.isFrozen(final.private.lio.hand)).toBe(true);
    expect(Object.isFrozen(final.secret.rng)).toBe(true);
  });
});

describe("invariant 1: someone can always answer", () => {
  it("fails an active game where no side has a pending decision", () => {
    const s = started();
    expect(() => checkLive(ruleset, s)).not.toThrow();
    expect(() => checkLive(ruleset, { ...s, public: { ...s.public, pending: [] } })).toThrow(/no side has a decision/);
  });

  it("passes a finished game with no pending decision", () => {
    const s = started();
    const over = {
      ...s,
      public: { ...s.public, pending: [], status: { kind: "over" as const, winner: null, reason: "test" } },
    };
    expect(() => checkLive(ruleset, over)).not.toThrow();
  });
});

describe("invariant 4: no view gives away the seed, the generator state or a hidden card", () => {
  it("hides the draw pile and the other side's hand from a side, and both hands from a spectator", () => {
    const s = started();
    expect(hiddenFrom(s, "lio").sort()).toEqual([...DECK, "c3"].sort());
    expect(hiddenFrom(s, "sae").sort()).toEqual([...DECK, "c1", "c2"].sort());
    expect(hiddenFrom(s, "spectator").sort()).toEqual([...DECK, "c1", "c2", "c3"].sort());
  });

  it("looks for each hidden card ID as a whole quoted string, so c1 is not set off by c10", () => {
    const secrets = { seed: SEED, rng: [1, 2, 3, 4], hidden: ["c1"] };
    expect(leaksIn('{"discard":["c10"]}', secrets)).toEqual([]);
    expect(leaksIn('{"discard":["c1"]}', secrets)).toEqual(['card "c1"']);
  });

  it("finds the seed, and the generator state by its exact JSON text", () => {
    const secrets = { seed: SEED, rng: [12, 345, 6789, 10], hidden: [] };
    expect(leaksIn(`{"x":"${SEED}"}`, secrets)).toEqual(["the seed"]);
    expect(leaksIn(`{"x":"${SEED}-hash"}`, secrets)).toEqual([]);
    expect(leaksIn('{"x":[12,345,6789,10]}', secrets)).toEqual(["the generator state"]);
    expect(leaksIn('{"x":[12,345,6789,1]}', secrets)).toEqual([]);
  });

  it("passes the views of a fresh game", () => {
    expect(() => checkNoLeaks(started(), [], SEED)).not.toThrow();
  });

  it("fails a view that shows a card still in the draw pile", () => {
    const s = started();
    const leaky = { ...s, public: { ...s.public, discard: ["c10"] } };
    expect(() => checkNoLeaks(leaky, [], SEED)).toThrow(/view for 'lio' shows card "c10"/);
  });

  it("fails an event list that shows a card hidden from that viewer", () => {
    const events: GameEvent[] = [{ kind: "marker", visibility: "public", label: "c3" }];
    expect(() => checkNoLeaks(started(), events, SEED)).toThrow(/events for 'lio' show card "c3"/);
  });

  it("does not count a card a side drew as hidden from that side", () => {
    const events: GameEvent[] = [
      {
        kind: "cardDrawn",
        visibility: "lio",
        side: "lio",
        card: "c1",
        publicForm: { kind: "cardDrawnHidden", visibility: "public", side: "lio" },
      },
    ];
    expect(() => checkNoLeaks(started(), events, SEED)).not.toThrow();
  });
});

describe("invariant 5: reconstruct rebuilds the exact state", () => {
  it("passes a fresh game", () => {
    expect(() => checkRebuilds(started())).not.toThrow();
  });

  it("fails a state with a field outside the three compartments", () => {
    const odd = { ...started(), extra: 1 } as GameState;
    expect(() => checkRebuilds(odd)).toThrow(/reconstruct for 'lio' does not rebuild the state: state\.extra differs/);
  });
});

describe("invariant 6: replaying the answer log gives the same final state", () => {
  it("fails when the final state differs from the replay", () => {
    const { record, final } = playFuzzGame(2);
    expect(() => checkReplay(record, final)).not.toThrow();
    const changed = { ...final, public: { ...final.public, turn: final.public.turn + 1 } };
    expect(() => checkReplay(record, changed)).toThrow(/state\.public\.turn/);
  });
});

describe("failure reports", () => {
  it("an engine call that throws is reported with its name, not as a crash", () => {
    expect(() =>
      attempt("viewFor('lio')", () => {
        throw new TypeError("Cannot assign to read only property");
      }),
    ).toThrow("viewFor('lio') threw: TypeError: Cannot assign to read only property");
  });

  it("a failing game prints its seed and answer list, ready to keep as a fixed case", () => {
    const bad: Answer = { decisionId: "no-such-decision", side: "lio", value: { kind: "pass" } };
    const record: GameRecord = { setup: randomGame(seededRng(3), 3).setup, seed: "fuzz-3", answers: [bad] };
    let report = "";
    try {
      playRecorded("bad answer", record);
    } catch (err) {
      report = String(err);
    }
    expect(report).toContain('Fixed game "bad answer" failed at answer 1');
    expect(report).toContain("unknownDecision");
    expect(report).toContain('"fuzz-3"');
    expect(report).toContain(JSON.stringify([bad]));
    expect(report).toContain("tests/fuzz/fixedGames.ts");
  });
});
