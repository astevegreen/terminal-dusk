// The region levels at each era's end (X12, #438): the highest level per side and region, with control from the
// engine and the battlegrounds of the era that is ending, and the per-era averages the report prints.
import { test } from "node:test";
import assert from "node:assert/strict";
import { eraEndNumbers, regionLevels } from "./region-stats.mjs";

// Two regions. North: a, b (battleground in era-1), c (battleground in both eras). South: d, e, no battlegrounds.
const country = (id, region) => ({ id, name: id, region, stability: 2, neighbours: [] });
const MAP = {
  regions: [{ id: "north" }, { id: "south" }],
  countries: [
    country("a", "north"),
    country("b", "north"),
    country("c", "north"),
    country("d", "south"),
    country("e", "south"),
  ],
  battlegrounds: [
    { era: "era-1", countries: ["b", "c"] },
    { era: "era-2", countries: ["c"] },
  ],
};
const LIO = { lio: 2, sae: 0 };
const SAE = { lio: 0, sae: 2 };
const NOBODY = { lio: 1, sae: 1 };
const view = (influence) => ({
  map: MAP,
  influence: Object.entries(influence).map(([id, at]) => ({ country: id, ...at })),
});
const levels = (present, ahead, everyBattleground) => ({ present, ahead, everyBattleground });

test("a side holding every battleground of a region counts that level only, not ahead or present", () => {
  const result = regionLevels(view({ a: SAE, b: LIO, c: LIO, d: NOBODY, e: NOBODY }), "era-1");
  assert.deepEqual(result.lio, { countries: 2, battlegrounds: 2, levels: levels(0, 0, 1) });
  // SAE controls a: present in the north, and nothing in the south.
  assert.deepEqual(result.sae, { countries: 1, battlegrounds: 0, levels: levels(1, 0, 0) });
});

test("ahead needs more countries and more battlegrounds; with no battlegrounds it needs more countries only", () => {
  // North: LIO a, b; SAE c. In era-1 LIO has 2 countries and 1 battleground (b) to SAE's 1 and 1: not ahead.
  const pub = view({ a: LIO, b: LIO, c: SAE, d: LIO, e: NOBODY });
  const one = regionLevels(pub, "era-1");
  assert.deepEqual(one.lio.levels, levels(1, 1, 0), "present in the north, ahead in the south");
  assert.deepEqual(one.sae.levels, levels(1, 0, 0));
  // In era-2 the only northern battleground is c, which SAE holds: SAE holds every battleground there.
  const two = regionLevels(pub, "era-2");
  assert.deepEqual(two.lio, { countries: 3, battlegrounds: 0, levels: levels(1, 1, 0) });
  assert.deepEqual(two.sae, { countries: 1, battlegrounds: 1, levels: levels(0, 0, 1) });
});

test("control comes from the engine: influence at least the stability and the rival's plus the stability", () => {
  // In a stability-2 country 3 against 2 is no control; 3 against 1 is (3 is at least 1 + 2).
  const close = regionLevels(view({ a: { lio: 3, sae: 2 } }), "era-1");
  assert.equal(close.lio.countries, 0);
  assert.deepEqual(close.lio.levels, levels(0, 0, 0));
  assert.equal(regionLevels(view({ a: { lio: 3, sae: 1 } }), "era-1").lio.countries, 1);
});

test("the era-end numbers average each era over the games that reached its end, in the order reached", () => {
  const end = (era, lio, sae) => ({
    era,
    lio: { countries: lio, battlegrounds: 0, levels: levels(lio, 0, 0) },
    sae: { countries: sae, battlegrounds: 1, levels: levels(0, sae, 0) },
  });
  const summaries = [{ eraEnds: [end("era-1", 1, 0), end("era-2", 2, 1)] }, { eraEnds: [end("era-1", 2, 1)] }];
  const rows = eraEndNumbers(summaries);
  assert.deepEqual(
    rows.map((row) => [row.era, row.games]),
    [
      ["era-1", 2],
      ["era-2", 1],
    ],
  );
  assert.deepEqual(rows[0].lio, { countries: 1.5, battlegrounds: 0, levels: levels(1.5, 0, 0) });
  assert.deepEqual(rows[0].sae, { countries: 0.5, battlegrounds: 1, levels: levels(0, 0.5, 0) });
  assert.equal(eraEndNumbers([{ eraEnds: [] }, {}]), undefined, "no map, no era ends");
});
