// Which models a review asks: read from `agy models`, Gemini's fast families only, and agy's Opus and Sonnet
// (agy.mjs, LIGHT, HEAVY and ORDERS). The rest of agy.mjs is tested in agy.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLAUDE,
  HEAVY,
  LIGHT,
  ORDERS,
  askFirstAvailable,
  claudeModel,
  lightModels,
  listModels,
  newerFirst,
  parseModels,
  reviewModels,
  unsorted,
} from "./agy.mjs";

const HYDROGEN = "gemini-4-hydrogen-high";
const FLASH = "gemini-3.8-flash-high";
const OPUS = "claude-opus-5-5-high";
const SONNET = "claude-sonnet-5-5-high";
const memory = () => ({ outUntil: () => null, markOut: () => {} });

// What `agy models` printed on 2026-11-19, two days after Neon's release, with 3.8 Flash still offered.
const AGY_MODELS = [
  "Fetching available models...",
  "gemini-4-neon-high\tGemini 4 Neon (High)",
  "gemini-4-neon-xhigh\tGemini 4 Neon (XHigh)",
  "gemini-4-argon-medium\tGemini 4 Argon (Medium)",
  "gemini-4-argon-high\tGemini 4 Argon (High)",
  "gemini-4-hydrogen-high\tGemini 4 Hydrogen (High)",
  "gemini-4-hydrogen-xhigh\tGemini 4 Hydrogen (XHigh)",
  "gemini-4-hydrogen-low\tGemini 4 Hydrogen (Low)",
  "gemini-pro-orchestrator-neon\tOrchestrator (Neon)",
  "gemini-pro-orchestrator-g1-pro\tOrchestrator (Argon)",
  "gemini-3.8-flash-high\tGemini 3.8 Flash (High)",
  "gemini-3.8-flash-medium\tGemini 3.8 Flash (Medium)",
  "claude-opus-5-5-high\tClaude Opus 5.5 (High)",
  "claude-sonnet-5-5-high\tClaude Sonnet 5.5 (High)",
  "gpt-oss-120b-medium\tGPT-OSS 120B (Medium)",
  "",
].join("\n");
const LISTED = parseModels(AGY_MODELS);
const agyLists = (stdout) => (args) => {
  assert.deepEqual(args, ["models"]);
  return { status: 0, stdout, stderr: "" };
};

test("every model a review asks runs at high effort", () => {
  for (const model of lightModels(null)) assert.match(model, /-high$/);
  for (const model of lightModels(LISTED)) assert.match(model, /-high$/);
});

// Owner, 19 Nov 2026: "I want to have the 2nd reviewer only use the less expensive "flash" type models-- the latest
// one of these is now Hydrogen."
test("of Gemini's models a review asks only the fast ones, newest first: never Neon or Argon", () => {
  assert.equal(LISTED.length, 14);
  assert.deepEqual(lightModels(LISTED), [HYDROGEN, FLASH]);
  assert.deepEqual(reviewModels(agyLists(AGY_MODELS)), { models: [HYDROGEN, FLASH], note: "" });
  assert.equal(LIGHT[0], "gemini-4-hydrogen");
  for (const heavy of ["argon", "carbon", "neon"]) assert.ok(HEAVY.includes(heavy), heavy);
});

test("a retired model drops out by itself, and a new version of a fast family is asked first, with no edit", () => {
  const retired = LISTED.filter((id) => !id.includes("flash"));
  assert.deepEqual(lightModels(retired), [HYDROGEN]);
  const newer = [...LISTED, "gemini-4.5-hydrogen-high", "gemini-10-flash-high", "gemini-5-neon-high"];
  assert.deepEqual(lightModels(newer), ["gemini-4.5-hydrogen-high", HYDROGEN, "gemini-10-flash-high", FLASH]);
});

test("a Gemini family nobody has sorted is named in a note, and is not asked", () => {
  const listed = [...LISTED, "gemini-5-helium-high", "gemini-5-helium-low", "gemini-5-carbon-high"];
  assert.deepEqual(unsorted(listed), ["gemini-5-helium-high"]);
  assert.deepEqual(unsorted(LISTED), []);
  // A family of two words is one family: named while unsorted, asked once it is in LIGHT, and not taken for Flash.
  const lite = [...LISTED, "gemini-5-flash-lite-high"];
  assert.deepEqual(unsorted(lite), ["gemini-5-flash-lite-high"]);
  assert.deepEqual(lightModels(lite), [HYDROGEN, FLASH]);
  assert.deepEqual(lightModels(lite, ["gemini-5-flash-lite", ...LIGHT]), ["gemini-5-flash-lite-high", HYDROGEN, FLASH]);
  const { models, note } = reviewModels(agyLists(`${AGY_MODELS}gemini-5-helium-high\tGemini 5 Helium (High)\n`));
  assert.deepEqual(models, [HYDROGEN, FLASH]);
  assert.match(
    note,
    /^New Gemini model in agy: gemini-5-helium-high\. .* add it to LIGHT in tools\/gemini\/agy\.mjs; if not, to HEAVY\.$/,
  );
});

test("when agy cannot list its models, the known fast models are asked as written", () => {
  const missing = () => ({ error: { code: "ENOENT" } });
  const signedOut = () => ({ status: 1, stdout: "", stderr: "sign in first" });
  for (const run of [missing, signedOut, agyLists("Fetching available models...\n")]) {
    assert.equal(listModels(run), null);
    assert.deepEqual(reviewModels(run), { models: [HYDROGEN, FLASH], note: "" });
  }
  // A retired one is then still asked: agy's words for it (2026-11-19) pass the review to the next model.
  const gone = new Error(
    'agy exited 1: error: invalid model selection (--model "gemini-3.8-flash-high" --effort ""): model gemini-3.8-flash-high is not recognized as a known model or custom model in settings',
  );
  const ask = (model) => {
    if (model === FLASH) throw gone;
    return "ok";
  };
  const result = askFirstAvailable([FLASH, HYDROGEN], ask, memory(), () => 0);
  assert.equal(result.model, HYDROGEN);
  assert.deepEqual(result.passed, [{ model: FLASH, why: "is no longer offered by agy" }]);
});

test("when agy lists no fast model this script knows, the report names the list to edit, and Gemini alone cannot review", () => {
  const onlyDeep = "gemini-5-neon-high\tGemini 5 Neon (High)\nclaude-opus-5-5-high\tClaude Opus 5.5 (High)\n";
  const edit = /lists none of the fast Gemini models .* LIGHT in tools\/gemini\/agy\.mjs/;
  assert.throws(() => reviewModels(agyLists(onlyDeep)), edit);
  const { models, note } = reviewModels(agyLists(onlyDeep), "deep");
  assert.deepEqual(models, [OPUS]);
  assert.match(note, /^No Gemini model reviews: agy lists none of the fast Gemini models .*\.$/);
  assert.match(note, edit);
  assert.throws(() => reviewModels(agyLists("gemini-5-neon-high\tGemini 5 Neon (High)\n"), "deep"), edit);
});

// Owner, 19 Nov 2026: "agy does also have Sonnet and Opus-- you should also use those models for 2nd review because
// I don't use them in agy anyway".
test("agy's Opus and Sonnet review too: a deep review starts on Opus, a standard one on Gemini, the rail audit skips Sonnet", () => {
  assert.deepEqual(Object.keys(ORDERS), ["deep", "standard", "rail", "gemini"]);
  const asks = (order, stdout = AGY_MODELS) => reviewModels(agyLists(stdout), order).models;
  assert.deepEqual(asks("deep"), [OPUS, HYDROGEN, FLASH, SONNET]);
  assert.deepEqual(asks("standard"), [HYDROGEN, FLASH, SONNET, OPUS]);
  assert.deepEqual(asks("rail"), [OPUS, HYDROGEN, FLASH]);
  assert.deepEqual(asks("gemini"), [HYDROGEN, FLASH]);
  for (const order of Object.keys(ORDERS)) assert.ok(!asks(order).some((id) => /argon|carbon|neon/.test(id)), order);
  // With no list, the Claude models are asked as written; with one, the newest version, and a dropped one is left out.
  assert.deepEqual(reviewModels(() => ({ error: { code: "ENOENT" } }), "deep").models, [OPUS, HYDROGEN, FLASH, SONNET]);
  assert.equal(`${CLAUDE.opus}-high`, OPUS);
  const newer = [...LISTED, "claude-opus-6-high", "claude-opus-5-10-high", "claude-opus-6-medium"];
  assert.equal(claudeModel(newer, "opus"), "claude-opus-6-high");
  assert.equal(claudeModel(newer, "sonnet"), SONNET);
  assert.equal(
    claudeModel(
      LISTED.filter((id) => !id.includes("sonnet")),
      "sonnet",
    ),
    null,
  );
  assert.deepEqual(asks("deep", AGY_MODELS.replace(/^claude-sonnet.*\n/gm, "")), [OPUS, HYDROGEN, FLASH]);
});

test("newerFirst orders versions number by number, newest first, with no locale", () => {
  assert.deepEqual(["3.8", "10", "4", "4.5", "9"].sort(newerFirst), ["10", "9", "4.5", "4", "3.8"]);
  assert.deepEqual(["5-5", "6", "5-10", "5"].sort(newerFirst), ["6", "5-10", "5-5", "5"]);
  assert.equal(newerFirst("4", "4"), 0);
  assert.ok(!/\.localeCompare\(/.test(readFileSync(new URL("./agy.mjs", import.meta.url), "utf8")));
});
