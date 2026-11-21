// An era entry that extends the era in play (docs/design/eras.md, "Optional scenario: 2025–2027"): the future cards
// enter on turn 11, but Era 3 scores only once, at the end of turn 11 (owner, 21 Nov 2026). An entry marked
// `extendsEra: true` still brings its cards in and moves the game to its battleground list, but the turn before it
// is not an era's end, so nothing scores then.
import { describe, expect, it } from "vitest";
import { apply } from "./apply.ts";
import { createGame } from "./createGame.ts";
import { legalAnswers } from "./decisions.ts";
import { seedHash } from "./sha256.ts";
import { ruleset, rulesetWith } from "./test/game.ts";
import { mapSetup, testMap } from "./test/map.ts";
import type { EraEntry, GameState, Setup, SetupMap } from "./types.ts";

/** The test ruleset plus e1, a card of era-2, and f1, a card of future. */
const base = rulesetWith([...ruleset.cards.map((card) => card.id), "e1", "f1"]);
const ERA_OF: Record<string, string> = { e1: "era-2", f1: "future" };
const rs = { ...base, cards: base.cards.map((card) => ({ ...card, era: ERA_OF[card.id] ?? card.era })) };

/** A map that scores, with a battleground list for each era the setups below use. */
const map: SetupMap = {
  ...testMap(),
  battlegrounds: [
    { era: "era-1", countries: ["charlie"] },
    { era: "era-2", countries: ["foxtrot"] },
    { era: "future", countries: ["foxtrot"] },
  ],
  startingInfluence: [],
  scoring: {
    track: { end: 10, start: 0 },
    regions: ["south", "east", "north"].map((region) => ({ region, present: 1, ahead: 2, all: 3 })),
  },
};

const ERA_2: EraEntry = { era: "era-2", turn: 2, cards: ["e1"] };
/** The future cards as a plain era entry, and as one that extends the era in play. */
const PLAIN_FUTURE: EraEntry = { era: "future", turn: 4, cards: ["f1"] };
const FUTURE: EraEntry = { ...PLAIN_FUTURE, extendsEra: true };
/** Four turns: era-1 for turn 1, era-2 from turn 2, the future cards joining era-2 on turn 4. */
const setupOf = (eras: EraEntry[] = [ERA_2, FUTURE]): Setup => ({ ...mapSetup(map, 4), eras });

function start(setup: Setup): GameState {
  const r = createGame(rs, { ...setup, seedHash: seedHash("seed-1") }, "seed-1");
  if (!r.ok) throw new Error(`createGame failed: ${r.error.message}`);
  return r.value.state;
}

/** Plays `setup` to its end with first legal answers; the turns whose end scored, and the eras each turn was in. */
function play(setup: Setup): { scored: number[]; eraOn: Record<number, string>; last: GameState } {
  let state = start(setup);
  const scored: number[] = [];
  const eraOn: Record<number, string> = { 1: state.public.era! };
  while (state.public.status.kind === "active") {
    const d = state.public.pending[0]!;
    const ending = state.public.turn;
    const r = apply(rs, state, { decisionId: d.id, side: d.side, value: legalAnswers(rs, state, d.side)[0]! });
    if (!r.ok) throw new Error(`answer rejected: ${r.error.code}`);
    state = r.value.state;
    if (r.value.events.some((e) => e.kind === "regionScored") && !scored.includes(ending)) scored.push(ending);
    eraOn[state.public.turn] = state.public.era!;
  }
  return { scored, eraOn, last: state };
}

const codeFor = (eras: unknown[]): string => {
  const r = createGame(rs, { ...mapSetup(map, 4), eras } as Setup, "seed-1");
  return r.ok ? "ok" : r.error.code;
};

describe("an era entry that extends the era in play", () => {
  it("does not make the turn before it an era's end: era-2 scores once, at the game's end", () => {
    expect(play(setupOf()).scored).toEqual([1, 4]);
  });
  it("without the mark, the same entry ends era-2 on the turn before it, as any era entry does", () => {
    expect(play(setupOf([ERA_2, PLAIN_FUTURE])).scored).toEqual([1, 3, 4]);
  });
  it("still brings its cards in on its turn and moves the game to its battleground list", () => {
    const { eraOn, last } = play(setupOf());
    expect(eraOn).toMatchObject({ 1: "era-1", 2: "era-2", 3: "era-2", 4: "future" });
    expect(last.secret.eras).toEqual([]);
  });
  it("waits in secret with its mark, and an entry without one gets no field", () => {
    expect(start(setupOf()).secret.eras).toEqual([
      { era: "era-2", turn: 2, cards: ["e1"] },
      { era: "future", turn: 4, cards: ["f1"], extendsEra: true },
    ]);
    expect(Object.hasOwn(start(setupOf()).secret.eras[0]!, "extendsEra")).toBe(false);
  });
});

describe("createGame checks an era entry's extendsEra", () => {
  it("accepts true, or no field at all", () => {
    expect(codeFor([ERA_2, FUTURE])).toBe("ok");
    expect(codeFor([ERA_2])).toBe("ok");
  });
  it("rejects any other value", () => {
    for (const value of [false, "yes", 1, null]) expect(codeFor([ERA_2, { ...FUTURE, extendsEra: value }])).toBe("invalidSetup");
  });
});
