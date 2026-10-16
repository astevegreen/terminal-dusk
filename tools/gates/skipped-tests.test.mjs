import { test } from "node:test";
import assert from "node:assert/strict";
import { findMarkers, isTestFile, scanRepo } from "./skipped-tests.mjs";
import { tempRepo, writeFiles } from "../hooks/test-helpers.mjs";

// Fixtures write ^ for the dot and ~ before an options object (it is dropped), so this file never trips
// the scan it tests.
const code = (text) => text.replaceAll("^", ".").replaceAll("~", "");
const found = (text) => findMarkers(code(text));

test("flags every way Vitest and node:test mark a test or suite as skipped or todo", () => {
  const calls = [
    "it^skip", "test^skip", "describe^skip", "suite^skip",
    "it^todo", "test^todo", "describe^todo", "suite^todo",
    "test^skipIf(isWindows)", "test^runIf(isWindows)", "describe^skipIf(isWindows)", "describe^runIf(isWindows)",
    "it^skip^each([1, 2])", "test^concurrent^skip", "describe^sequential^skip",
  ];
  for (const call of calls) {
    const markers = found(`${call}("draws a card", () => {});\n`);
    assert.equal(markers.length, 1, code(call));
    assert.equal(markers[0].focused, false, code(call));
  }
});

test("flags focused tests, which stop the tests around them from running", () => {
  for (const call of ["it^only", "test^only", "describe^only", "suite^only", "test^concurrent^only"]) {
    const markers = found(`${call}("draws a card", () => {});\n`);
    assert.equal(markers.length, 1, code(call));
    assert.equal(markers[0].focused, true, code(call));
  }
});

test("flags node:test and Vitest skip, todo and only options, even when the options span lines", () => {
  const sources = [
    `test("draws", ~{ skip: true }, () => {});`,
    `test("draws", ~{ todo: "write it" }, () => {});`,
    `it('draws', ~{ timeout: 500, skip: isWindows }, () => {});`,
    "describe(`deck`, ~{ only: true }, () => {});",
    `t^test("part a", ~{ skip: process.platform === "win32" }, () => {});`,
  ];
  for (const source of sources) assert.equal(found(source).length, 1, code(source));

  const multiline = found(`it("draws", ~{\n  timeout: 500,\n  skip: isWindows,\n}, () => {});\n`);
  assert.deepEqual(multiline.map((m) => m.line), [3]);
  assert.equal(found(`describe("deck", ~{ only: true }, () => {});`)[0].focused, true);
});

test("flags a test that skips itself from inside", () => {
  for (const call of ["t^skip()", "t^todo()", "ctx^skip()", `context^skip("not on Windows")`]) {
    assert.equal(found(`test("draws", (t) => { ${call}; });\n`).length, 1, code(call));
  }
});

test("reports the line of the marker itself, even when the call spans lines", () => {
  const markers = found(`import { test } from "vitest";\n\ntest\n  ^skip("draws", () => {});\n`);
  assert.deepEqual(markers.map((m) => m.line), [4]);
  assert.match(markers[0].marker, /^test\.skip$/);
});

test("leaves ordinary code that happens to say skip, only or todo alone", () => {
  const source = [
    `test("skips a turn when the player passes", () => { turn^skip(); });`,
    `it("plays only one card", () => { expect(hand^only).toBe(true); });`,
    `test("lists todo items", () => { const card = { skip: 1, only: 2, todo: 3 }; });`,
    `test("parses flags", () => { expect(parse(["--only"])).toEqual({ only: true }); });`,
    `test^each([{ skip: 1 }])("row %#", () => { skipIfEmpty(list); });`,
    `const { only, skip } = options;`,
  ].join("\n");
  assert.deepEqual(found(source), []);
});

test("scans test files anywhere and every code file under tests/, nothing else", () => {
  for (const file of [
    "packages/engine/src/deck.test.ts", "packages/app/src/App.test.tsx", "packages/ai/src/plan.spec.ts",
    "tools/gates/gate.test.mjs", "tests/fuzz/helpers.ts", "tests/golden/replays.test.ts",
  ]) assert.equal(isTestFile(file), true, file);
  for (const file of [
    "packages/engine/src/skip.ts", "tools/gates/skipped-tests.mjs", "tests/README.md", "docs/notes.md", "package.json",
  ]) assert.equal(isTestFile(file), false, file);
});

test("reports each marker as file:line with what to do, including files git doesn't track yet", () => {
  const repo = tempRepo({ "packages/engine/src/clean.test.ts": `test("draws", () => {});\n` });
  writeFiles(repo, {
    "packages/engine/src/deck.test.ts": code(`import { it } from "vitest";\nit^skip("draws", () => {});\nit^only("deals", () => {});\n`),
    "packages/engine/src/turn.ts": code(`export const next = (t) => t^skip();\n`),
  });
  const lines = scanRepo(repo);
  assert.equal(lines.length, 2, lines.join("\n"));
  assert.match(lines[0], /^packages\/engine\/src\/deck\.test\.ts:2: it\.skip .*Make it pass/);
  assert.match(lines[1], /^packages\/engine\/src\/deck\.test\.ts:3: it\.only .*other tests/);
});

test("a repository with no skipped or focused tests reports nothing", () => {
  const repo = tempRepo({ "packages/engine/src/deck.test.ts": `test("draws", () => {});\n` });
  assert.deepEqual(scanRepo(repo), []);
});
