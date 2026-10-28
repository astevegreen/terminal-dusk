// Battlegrounds by era (#429): each era has its own list on the map, matched by name; the public state's era says
// whose list counts, from the setup's first era until the next era enters.
import { describe, expect, it } from "vitest";
import { isBattleground } from "./battlegrounds.ts";
import { createGame } from "./createGame.ts";
import { seedHash } from "./sha256.ts";
import { viewFor } from "./views.ts";
import { makeSetup, playAnswers, ruleset, rulesetWith } from "./test/game.ts";
import { mapSetup, testMap } from "./test/map.ts";
import type { EngineError, GameState, Setup, SetupMap } from "./types.ts";

/** The test ruleset plus e1, a card of era-2. */
const base = rulesetWith([...ruleset.cards.map((card) => card.id), "e1"]);
const rs = { ...base, cards: base.cards.map((card) => (card.id === "e1" ? { ...card, era: "era-2" } : card)) };

/** The test map with a second list: era-2's only battleground is foxtrot. */
const twoEraMap = (): SetupMap => ({
  ...testMap(),
  battlegrounds: [
    { era: "era-1", countries: ["charlie", "delta"] },
    { era: "era-2", countries: ["foxtrot"] },
  ],
});
/** Three turns on `map`, starting in era-1, with era-2 entering on turn 2. */
const twoEraSetup = (map: SetupMap = twoEraMap()): Setup => ({
  ...mapSetup(map, 3),
  eras: [{ era: "era-2", turn: 2, cards: ["e1"] }],
});

const refusal = (setup: Setup): EngineError | null => {
  const r = createGame(rs, setup, "seed-1");
  return r.ok ? null : r.error;
};
const start = (setup: Setup): GameState => {
  const r = createGame(rs, { ...setup, seedHash: seedHash("seed-1") }, "seed-1");
  if (!r.ok) throw new Error(`createGame failed: ${r.error.message}`);
  return r.value.state;
};
/** Turn 1 takes 4 answers (two opening picks, one play each); the 4th opens turn 2. */
const inTurn2 = (setup: Setup): GameState => playAnswers(start(setup), 4, rs);

describe("the setup's battleground lists", () => {
  it("accepts a list for each of the game's eras (so each refusal below is caused by its own change)", () => {
    expect(refusal(twoEraSetup())).toBeNull();
  });
  it("refuses a setup with a map that names no first era", () => {
    const setup = mapSetup();
    delete setup.firstEra;
    expect(refusal(setup)).toMatchObject({ code: "invalidSetup", message: /first era/ });
  });
  it("refuses a map with no list for the first era", () => {
    const setup = { ...mapSetup(), firstEra: "era-0" };
    expect(refusal(setup)).toMatchObject({ code: "invalidSetup", message: /no battleground list for era era-0/ });
  });
  it("refuses a map with no list for a later era", () => {
    expect(refusal(twoEraSetup(testMap()))).toMatchObject({
      code: "invalidSetup",
      message: /no battleground list for era era-2/,
    });
  });
  it("refuses a map with two lists for one era", () => {
    const map = { ...testMap(), battlegrounds: [...testMap().battlegrounds, { era: "era-1", countries: [] }] };
    expect(refusal(mapSetup(map))).toMatchObject({ code: "invalidSetup", message: /two battleground lists.*era-1/ });
  });
  it("refuses a list naming a country the map does not have", () => {
    const map = { ...testMap(), battlegrounds: [{ era: "era-1", countries: ["zulu"] }] };
    expect(refusal(mapSetup(map))).toMatchObject({ code: "invalidSetup", message: /era-1.*unknown country zulu/ });
  });
  it("refuses a list naming a country twice", () => {
    const map = { ...testMap(), battlegrounds: [{ era: "era-1", countries: ["delta", "delta"] }] };
    expect(refusal(mapSetup(map))).toMatchObject({ code: "invalidSetup", message: /era-1.*delta twice/ });
  });
  it("refuses, without throwing, battlegrounds that are not a list of { era, countries }", () => {
    for (const battlegrounds of [undefined, "era-1", [null], [{ era: "", countries: [] }], [{ era: "era-1" }]]) {
      const map = { ...testMap(), battlegrounds } as unknown as SetupMap;
      expect(refusal(mapSetup(map))?.code).toBe("invalidSetup");
    }
  });
  it("accepts an empty list: an era may have no battlegrounds", () => {
    expect(refusal(mapSetup({ ...testMap(), battlegrounds: [{ era: "era-1", countries: [] }] }))).toBeNull();
  });
  it("accepts lists for eras the setup does not use, so one map serves any deck", () => {
    expect(refusal(mapSetup(twoEraMap()))).toBeNull();
  });
  it("ignores firstEra in a setup with no map", () => {
    expect(refusal({ ...makeSetup(), firstEra: "era-1" })).toBeNull();
  });
});

describe("two eras may not share a name", () => {
  it("refuses a later era named like the first", () => {
    const setup = { ...twoEraSetup(), firstEra: "era-2", map: { ...twoEraMap() } };
    expect(refusal(setup)).toMatchObject({ code: "invalidSetup", message: /Two eras are named era-2/ });
  });
  it("refuses two later eras with the same name", () => {
    const setup = {
      ...twoEraSetup(),
      eras: [
        { era: "era-2", turn: 2, cards: ["e1"] },
        { era: "era-2", turn: 3, cards: ["e1"] },
      ],
    };
    expect(refusal(setup)).toMatchObject({ code: "invalidSetup", message: /Two eras are named era-2/ });
  });
});

describe("the current era in the public state", () => {
  it("is the setup's first era when a game with a map starts", () => {
    expect(start(twoEraSetup()).public.era).toBe("era-1");
  });
  it("is absent in a game with no map, even when the setup names a first era", () => {
    const s = start({ ...makeSetup(), firstEra: "era-1" });
    expect("era" in s.public).toBe(false);
  });
  it("becomes the entering era at the start of its turn", () => {
    expect(inTurn2(twoEraSetup()).public.era).toBe("era-2");
  });
  it("stays absent in a game with no map when a later era enters", () => {
    const s = inTurn2({ ...makeSetup(3), eras: [{ era: "era-2", turn: 2, cards: ["e1"] }] });
    expect(s.public.turn).toBe(2);
    expect("era" in s.public).toBe(false);
  });
  it("every player sees the era and every era's list", () => {
    const s = start(twoEraSetup());
    for (const viewer of ["lio", "sae", "spectator"] as const) {
      const view = viewFor(s, viewer);
      expect(view.public.era).toBe("era-1");
      expect(view.public.map?.battlegrounds).toStrictEqual(twoEraMap().battlegrounds);
    }
  });
});

describe("isBattleground", () => {
  it("is true exactly for the countries on the current era's list", () => {
    const s = start(twoEraSetup());
    const now = s.public.map!.countries.filter((c) => isBattleground(s.public, c.id)).map((c) => c.id);
    expect(now).toEqual(["charlie", "delta"]);
  });
  it("follows the next era's list once it enters", () => {
    const s = inTurn2(twoEraSetup());
    const now = s.public.map!.countries.filter((c) => isBattleground(s.public, c.id)).map((c) => c.id);
    expect(now).toEqual(["foxtrot"]);
  });
  it("is false for every country in an era with an empty list", () => {
    const s = start(mapSetup({ ...testMap(), battlegrounds: [{ era: "era-1", countries: [] }] }));
    expect(s.public.map!.countries.some((c) => isBattleground(s.public, c.id))).toBe(false);
  });
  it("is false in a game with no map", () => {
    expect(isBattleground(start(makeSetup()).public, "charlie")).toBe(false);
  });
});
