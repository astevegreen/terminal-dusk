// Tests for the fuzz harness itself: each check catches what it should, so a green fuzz run means something.
import { apply, createGame, pendingFor, seedHash, SIDES, verifyGame } from "@terminal-dusk/engine";
import type { Answer, GameEvent, GameState, Setup, Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import {
  attempt,
  checkLive,
  checkNoLeaks,
  checkRebuilds,
  checkSeedHash,
  checkStep,
  checkVerify,
  hiddenFrom,
  leaksIn,
  NEW_GAME,
} from "./checks.ts";
import { FIXED_GAMES } from "./fixedGames.ts";
import { byCodeUnit } from "./order.ts";
import { checkReplay, gameCount, playFuzzGame, playRecorded, randomGame, ruleset } from "./play.ts";
import type { GameRecord } from "./play.ts";
import { seededRng } from "./random.ts";

const SEED = "harness-seed";
const DECK = ["c6", "c7", "c8", "c9", "c10", "c11", "c12", "c13", "c14"];

const harnessSetup: Setup = {
  seedHash: seedHash(SEED),
  hands: { lio: ["c1", "c4"], sae: ["c2", "c5"] },
  deck: DECK,
  turns: 1,
  playsPerTurn: 1,
  handSize: 2,
  contingency: { lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6] },
};

/**
 * A new game; by default one turn of one play each, with known cards: LIO holds its cards c1 and c4,
 * SAE its cards c2 and c5, the draw pile is c6 to c14.
 */
function started(setup: Setup = harnessSetup, seed = SEED): GameState {
  const r = createGame(ruleset, setup, seed);
  if (!r.ok) throw new Error(`createGame failed: ${r.error.code}`);
  return r.value.state;
}

/** The cards of all the setup's later eras. */
const eraCards = (setup: Setup) => (setup.eras ?? []).flatMap((entry) => entry.cards);

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
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2]);
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
      const cards = [...setup.hands.lio, ...setup.hands.sae, ...setup.deck, ...eraCards(setup)];
      expect(new Set(cards).size).toBe(cards.length);
      expect(setup.turns).toBeGreaterThanOrEqual(1);
      expect(setup.playsPerTurn).toBeGreaterThanOrEqual(1);
    }
  });

  it("the fuzz ruleset holds every card the random setups and the fixed games use", () => {
    const known = new Set(ruleset.cards.map((card) => card.id));
    const setups = [
      ...Array.from({ length: 1000 }, (_, i) => randomGame(seededRng(i + 1), i + 1).setup),
      ...FIXED_GAMES.map((game) => game.record.setup),
    ];
    const unknown = setups.flatMap((setup) =>
      [...setup.hands.lio, ...setup.hands.sae, ...setup.deck, ...eraCards(setup)].filter((card) => !known.has(card)),
    );
    expect(unknown).toEqual([]);
  });

  it("when both sides are waiting, the side that answers first is picked at random, so both orders get played", () => {
    const sides = Array.from({ length: 20 }, (_, i) => firstAnswerers(playFuzzGame(i + 1).record)).flat();
    expect(sides).toContain("lio");
    expect(sides).toContain("sae");
  });

  it("the random games pause opening events for a yes/no choice, and play one and two plays a turn", () => {
    let pausedEvents = 0;
    for (let game = 1; game <= 20; game++) {
      const { record } = playFuzzGame(game);
      let state = started(record.setup, record.seed);
      for (const answer of record.answers) {
        const next = apply(ruleset, state, answer);
        if (!next.ok) throw new Error(`apply failed: ${next.error.code}`);
        state = next.value.state;
        if (state.public.inPlay.length > 0 && state.public.pending.some((d) => d.kind === "yesNo")) pausedEvents++;
      }
    }
    expect(pausedEvents).toBeGreaterThan(5);
    const plays = Array.from({ length: 50 }, (_, i) => randomGame(seededRng(i + 1), i + 1).setup.playsPerTurn);
    expect(new Set(plays)).toEqual(new Set([1, 2]));
  });

  it("the random games draw contingencies and reshuffle a deck, for each side, so the deck checks run on real draws", () => {
    const seen = new Set<string>();
    for (let game = 1; game <= 20; game++) {
      const { record } = playFuzzGame(game);
      let state = started(record.setup, record.seed);
      for (const answer of record.answers) {
        const next = apply(ruleset, state, answer);
        if (!next.ok) throw new Error(`apply failed: ${next.error.code}`);
        state = next.value.state;
        for (const e of next.value.events) {
          if (e.kind === "contingencyDrawn" || e.kind === "contingencyDeckReshuffled") seen.add(`${e.kind} ${e.side}`);
        }
      }
    }
    expect([...seen].sort(byCodeUnit)).toEqual([
      "contingencyDeckReshuffled lio",
      "contingencyDeckReshuffled sae",
      "contingencyDrawn lio",
      "contingencyDrawn sae",
    ]);
  });

  it("the random games play cards for their events and their points, and play rival cards with the event before and after", () => {
    const uses = new Set<string>();
    for (let game = 1; game <= 20; game++) {
      for (const answer of playFuzzGame(game).record.answers) {
        if (!("value" in answer)) continue;
        if (answer.value.kind === "playCardAs") uses.add(`play for ${answer.value.as}`);
        if (answer.value.kind === "rivalEventOrder") uses.add(`rival event ${answer.value.event}`);
      }
    }
    expect([...uses].sort(byCodeUnit)).toEqual([
      "play for event",
      "play for points",
      "rival event after",
      "rival event before",
    ]);
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
    expect(hiddenFrom(s, "lio").sort(byCodeUnit)).toEqual([...DECK, "c2", "c5"].sort(byCodeUnit));
    expect(hiddenFrom(s, "sae").sort(byCodeUnit)).toEqual([...DECK, "c1", "c4"].sort(byCodeUnit));
    expect(hiddenFrom(s, "spectator").sort(byCodeUnit)).toEqual([...DECK, "c1", "c4", "c2", "c5"].sort(byCodeUnit));
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
    const events: GameEvent[] = [{ kind: "marker", visibility: "public", label: "c2" }];
    expect(() => checkNoLeaks(started(), events, SEED)).toThrow(/events for 'lio' show card "c2"/);
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

describe("the seed fingerprint: every view shows the true hash of the seed", () => {
  it("passes a fresh game", () => {
    expect(() => checkSeedHash(started(), SEED)).not.toThrow();
  });

  it("fails when a view's meta.seedHash has been changed by hand", () => {
    const s = started();
    const forged = { ...s, meta: { ...s.meta, seedHash: seedHash("another-seed") } };
    expect(() => checkSeedHash(forged, SEED)).toThrow(/view for 'lio' shows a seedHash that is not the hash/);
  });

  it("is part of the checks on every step of a played game", () => {
    const s = started();
    const forged = { ...s, meta: { ...s.meta, seedHash: seedHash("another-seed") } };
    expect(() => checkStep(ruleset, harnessSetup, forged, [], SEED, NEW_GAME)).toThrow(/not the hash of the seed/);
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
    expect(() => checkReplay(ruleset, record, final)).not.toThrow();
    const changed = { ...final, public: { ...final.public, turn: final.public.turn + 1 } };
    expect(() => checkReplay(ruleset, record, changed)).toThrow(/state\.public\.turn/);
  });
});

describe("verifyGame on a finished game", () => {
  const GAMES = 20;
  const ended = Array.from({ length: GAMES }, (_, i) => playFuzzGame(i + 1));

  it("refuses a wrong seed and a log missing its last answer, on about 20 random games", () => {
    for (const { record } of ended) {
      const wrongSeed = verifyGame(ruleset, record.setup, `${record.seed}-wrong`, record.answers);
      expect(!wrongSeed.ok && wrongSeed.error.code).toBe("seedMismatch");
      const cutShort = verifyGame(ruleset, record.setup, record.seed, record.answers.slice(0, -1));
      expect(!cutShort.ok && cutShort.error.code).toBe("unfinishedLog");
    }
  });

  it("checkVerify fails when the final state or the events differ from the game's own", () => {
    const { record, final } = ended[0]!;
    const r = verifyGame(ruleset, record.setup, record.seed, record.answers);
    if (!r.ok) throw new Error("verifyGame refused a finished game");
    expect(() => checkVerify(ruleset, record, final, r.value.events)).not.toThrow();
    const changed = { ...final, public: { ...final.public, turn: final.public.turn + 1 } };
    expect(() => checkVerify(ruleset, record, changed, r.value.events)).toThrow(
      /different final state: state.public.turn/,
    );
    expect(() => checkVerify(ruleset, record, final, r.value.events.slice(1))).toThrow(/different events/);
    expect(() =>
      checkVerify(ruleset, { ...record, answers: record.answers.slice(0, -1) }, final, r.value.events),
    ).toThrow(/unfinishedLog/);
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
    const bad: Answer = {
      decisionId: "no-such-decision",
      side: "lio",
      value: { kind: "playCardAs", card: "c1", as: "event" },
    };
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
