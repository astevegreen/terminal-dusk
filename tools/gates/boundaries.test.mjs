import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkBoundaries } from "./boundaries.mjs";
import { writeFiles } from "../hooks/test-helpers.mjs";

const PACKAGES = ["engine", "content", "host", "ai", "app", "server"];

// A throwaway workspace with all six packages plus `files` ({ "packages/engine/src/a.ts": "..." }).
function workspace(files) {
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), "td-boundaries-")));
  const manifests = Object.fromEntries(
    PACKAGES.map((p) => [`packages/${p}/package.json`, JSON.stringify({ name: `@terminal-dusk/${p}` })]),
  );
  writeFiles(root, { ...manifests, ...files });
  return root;
}
const problems = (files) => checkBoundaries(workspace(files));
const where = (list) => list.map((p) => `${p.file}:${p.line}`);

test("a workspace that follows the package table passes", () => {
  const list = problems({
    "packages/engine/src/index.ts": 'import { step } from "./step.ts";\nexport const run = step;\n',
    "packages/engine/src/step.ts": "export const step = (n: number) => n + 1;\n",
    "packages/content/src/index.ts": 'import type { run } from "@terminal-dusk/engine";\nexport type R = typeof run;\n',
    "packages/host/src/index.ts": 'import { run } from "@terminal-dusk/engine";\nimport "@terminal-dusk/content";\nexport { run };\n',
    "packages/app/src/App.tsx": 'import { run } from "@terminal-dusk/host";\nimport React from "react";\nexport const A = () => <p>{run(1)}</p>;\n',
  });
  assert.deepEqual(list, []);
});

test("engine code may not import npm packages, Node built-ins or other workspace packages", () => {
  const list = problems({
    "packages/engine/src/a.ts": 'import React from "react";\nimport { readFileSync } from "node:fs";\nimport "@terminal-dusk/content";\n',
  });
  assert.deepEqual(where(list), ["packages/engine/src/a.ts:1", "packages/engine/src/a.ts:2", "packages/engine/src/a.ts:3"]);
  assert.match(list[0].message, /"react": the engine imports nothing outside itself \(hard rule 1\)/);
  assert.match(list[2].message, /packages\/engine may not import packages\/content/);
});

test("engine test files may import test tools, but nothing else from outside the engine", () => {
  const list = problems({
    "packages/engine/src/a.test.ts":
      'import { test } from "vitest";\nimport fc from "fast-check";\nimport { readFileSync } from "node:fs";\nimport _ from "lodash";\nimport "@terminal-dusk/content";\n',
  });
  assert.deepEqual(where(list), ["packages/engine/src/a.test.ts:4", "packages/engine/src/a.test.ts:5"]);
});

test("relative imports may not leave the package folder", () => {
  const list = problems({
    "packages/engine/src/deep/a.ts": 'import "../b.ts";\nimport "../../../content/src/index.ts";\n',
    "packages/app/src/a.ts": 'import "../../server/src/index.ts";\n',
  });
  assert.deepEqual(where(list), ["packages/app/src/a.ts:1", "packages/engine/src/deep/a.ts:2"]);
  assert.match(list[0].message, /reaches outside packages\/app by a relative path/);
});

test("engine code may not use Date, Math.random, timers, the DOM or the network", () => {
  const list = problems({
    "packages/engine/src/a.ts": [
      "export const a = new Date();",
      "export const b = Date.now();",
      "export const c = Math.random();",
      'export const d = Math["random"]();',
      "setTimeout(() => 0, 1);",
      'fetch("https://example.com");',
      "export const e = document.title;",
      "export const f = globalThis;",
      "export type G = { at: Date };",
      "export const h = { Date };",
    ].join("\n"),
  });
  assert.deepEqual(where(list).map((w) => Number(w.split(":")[1])), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.match(list[2].message, /^Math\.random: all randomness comes from the PRNG/);
  assert.match(list[4].message, /^setTimeout: the engine has no timers/);
});

test("engine code may not pull Math.random out by destructuring", () => {
  const list = problems({
    "packages/engine/src/a.ts": [
      "const { random } = Math;",
      "const { random: r } = Math;",
      'const { ["random"]: q } = Math;',
      "export const x = random() + r() + q();",
      "let s, t;",
      "({ random: s } = Math);",
      "({ t } = Math as { t: () => number });",
      "const { random: u } = (Math);",
      "export const z = (Math).random() + s() + t() + u();",
    ].join("\n"),
    "packages/engine/src/a.test.ts": "const { random } = Math;\nexport const y = random();\n",
  });
  assert.deepEqual(where(list).map((w) => Number(w.split(":")[1])), [1, 2, 3, 6, 8, 9]);
  for (const p of list) assert.match(p.message, /^Math\.random: all randomness comes from the PRNG/);
});

test("destructuring other Math functions, or random from an engine object, is allowed", () => {
  const list = problems({
    "packages/engine/src/a.ts": [
      "const { floor, max } = Math;",
      "const rng = { random: () => 1 };",
      "const { random } = rng;",
      "export const x = floor(max(1, random()));",
    ].join("\n"),
  });
  assert.deepEqual(list, []);
});

test("names that only look like forbidden globals are allowed in the engine", () => {
  const list = problems({
    "packages/engine/src/date.ts": "export const Date = 1;\n",
    "packages/engine/src/a.ts": [
      'import { Date } from "./date.ts";',
      "export const x = Date + 1;",
      "const state = { Date: 1, random: 2, document: 3 };",
      "export const y = state.Date + state.random + state.document;",
      "export type T = { setTimeout: number; fetch(): void };",
      "export function f(setTimeout: number) { return setTimeout; }",
      'export const note = "Math.random() and Date.now() are forbidden"; // so is new Date()',
    ].join("\n"),
  });
  assert.deepEqual(list, []);
});

test("engine test files may use the clock and randomness", () => {
  const list = problems({ "packages/engine/src/a.test.ts": "export const t = Date.now() + Math.random();\n" });
  assert.deepEqual(list, []);
});

test("a forbidden global is caught even when the engine's lib setting leaves it undefined", () => {
  const list = problems({
    "packages/engine/tsconfig.json": JSON.stringify({ compilerOptions: { lib: ["es2024"], types: [] } }),
    "packages/engine/src/a.ts": "setTimeout(() => 0, 1);\nexport const w = window;\n",
  });
  assert.deepEqual(where(list), ["packages/engine/src/a.ts:1", "packages/engine/src/a.ts:2"]);
});

test("GameState may be used in engine and host but nowhere else", () => {
  const list = problems({
    "packages/engine/src/state.ts": "export type GameState = { seq: number };\n",
    "packages/host/src/a.ts": 'import type { GameState } from "@terminal-dusk/engine";\nexport type S = GameState;\n',
    "packages/app/src/a.ts": 'import type { GameState as GS } from "@terminal-dusk/engine";\nexport type S = GS;\n',
    "packages/ai/src/a.ts": 'import type * as E from "@terminal-dusk/engine";\nexport type S = E.GameState;\n',
    "packages/server/src/a.ts": 'export type S = import("@terminal-dusk/engine").GameState;\n',
  });
  assert.deepEqual(where(list), ["packages/ai/src/a.ts:2", "packages/app/src/a.ts:1", "packages/server/src/a.ts:1"]);
  assert.match(list[0].message, /GameState is used outside engine and host \(hard rule 2\)/);
});

test("content may import only types from the engine, except in its tests", () => {
  const list = problems({
    "packages/content/src/a.ts": [
      'import { apply } from "@terminal-dusk/engine";',
      'import type { Side } from "@terminal-dusk/engine";',
      'import { type Answer } from "@terminal-dusk/engine";',
      'export type { Decision } from "@terminal-dusk/engine";',
      "export const x = apply;",
    ].join("\n"),
    "packages/content/cards/early/c1.test.ts": 'import { apply } from "@terminal-dusk/engine";\nexport const y = apply;\n',
  });
  assert.deepEqual(where(list), ["packages/content/src/a.ts:1"]);
  assert.match(list[0].message, /may import only types from packages\/engine outside its tests/);
});

test("each package imports only the workspace packages the table allows", () => {
  const list = problems({
    "packages/app/src/a.ts": 'import "@terminal-dusk/server";\nimport "@terminal-dusk/content";\n',
    "packages/host/src/a.ts": 'import "@terminal-dusk/ai";\n',
    "packages/ai/src/a.ts": 'import "@terminal-dusk/host";\n',
    "shells/steam/package.json": JSON.stringify({ name: "@terminal-dusk/steam" }),
    "shells/steam/src/main.ts": 'import "@terminal-dusk/app";\nimport "@terminal-dusk/engine";\n',
    "packages/extra/package.json": JSON.stringify({ name: "@terminal-dusk/extra" }),
    "packages/extra/src/a.ts": 'import "@terminal-dusk/engine";\n',
  });
  assert.deepEqual(where(list), [
    "packages/ai/src/a.ts:1",
    "packages/app/src/a.ts:1",
    "packages/app/src/a.ts:2",
    "packages/extra/src/a.ts:1",
    "packages/host/src/a.ts:1",
    "shells/steam/src/main.ts:2",
  ]);
  assert.match(list[3].message, /packages\/extra is not in the package table/);
});

test("an import may not reach past another package's entry point", () => {
  const list = problems({
    "packages/content/package.json": JSON.stringify({ name: "@terminal-dusk/content", exports: { ".": "./src/index.ts", "./schema": "./schema/index.ts" } }),
    "packages/host/src/a.ts": [
      'import { nextInt } from "@terminal-dusk/engine/src/rng.ts";',
      'import { Card } from "@terminal-dusk/content/schema";',
      'import { cards } from "@terminal-dusk/content";',
      'import type { Raw } from "@terminal-dusk/content/src/raw.ts";',
      'export * from "@terminal-dusk/content/src/index.ts";',
      "export const x = [nextInt, Card, cards];",
    ].join("\n"),
  });
  assert.deepEqual(where(list), ["packages/host/src/a.ts:1", "packages/host/src/a.ts:4", "packages/host/src/a.ts:5"]);
  assert.match(list[0].message, /"@terminal-dusk\/engine\/src\/rng\.ts" reaches past the entry point of packages\/engine/);
});

test("app may import types and the listed helpers from the engine, but no other values", () => {
  const list = problems({
    "packages/app/src/a.ts": [
      'import { SIDES, controller, seedHash, type Side } from "@terminal-dusk/engine";',
      'import type { Frame } from "@terminal-dusk/engine";',
      'import { apply } from "@terminal-dusk/engine";',
      'import { SIDES as S, legalAnswers } from "@terminal-dusk/engine";',
      'import * as E from "@terminal-dusk/engine";',
      'export { apply as run } from "@terminal-dusk/engine";',
      'export const e = await import("@terminal-dusk/engine");',
      "export const x = [SIDES, controller, seedHash, apply, S, legalAnswers, E];",
      "export type Y = Side | Frame;",
    ].join("\n"),
    "packages/app/src/a.test.ts": 'import { apply } from "@terminal-dusk/engine";\nexport const t = apply;\n',
  });
  assert.deepEqual(where(list).map((w) => Number(w.split(":")[1])), [3, 4, 5, 6, 7]);
  assert.match(list[0].message, /^packages\/app may import from packages\/engine only types and DECKS, SIDES, controller, seedHash outside its tests, not "apply"/);
  assert.match(list[0].message, /docs\/architecture\.md, Guardrails, "May import"/);
  assert.match(list[2].message, /not the whole module/);
  assert.match(list[1].message, /"legalAnswers"/);
  assert.doesNotMatch(list[1].message, /"SIDES"/);
});

test("dynamic imports, require, re-exports and computed paths are checked too", () => {
  const list = problems({
    "packages/engine/src/a.ts": [
      'export const r = await import("react");',
      'export const fs = require("fs");',
      'export * from "lodash";',
      "const name = 'x';",
      "export const m = await import(name);",
    ].join("\n"),
  });
  assert.deepEqual(where(list).map((w) => Number(w.split(":")[1])), [1, 2, 2, 3, 5]);
  assert.match(list[4].message, /path is computed/);
});

test("the engine's package.json may not declare dependencies", () => {
  const list = problems({
    "packages/engine/package.json": JSON.stringify({ name: "@terminal-dusk/engine", dependencies: { lodash: "1" } }),
  });
  assert.deepEqual(where(list), ["packages/engine/package.json:1"]);
});
