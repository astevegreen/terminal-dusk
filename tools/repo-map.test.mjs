import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMap, describeFile, exportsOf, renderMap } from "./repo-map.mjs";
import { sh, tempRepo, writeFiles } from "./hooks/test-helpers.mjs";

test("a code file is described by the first sentence of its opening comment", () => {
  const text = "#!/usr/bin/env node\n// Runs the thing. Second sentence\n// continues here.\nexport const a = 1;\n";
  assert.equal(describeFile("tools/run.mjs", text), "Runs the thing.");
  assert.equal(
    describeFile("a.ts", "// One idea that\n// spans two lines\n\n// Not this.\n"),
    "One idea that spans two lines",
  );
  assert.equal(describeFile("a.ts", "/**\n * Block comment text.\n * More.\n */\n"), "Block comment text.");
  assert.equal(describeFile("a.ts", "export const a = 1; // trailing\n"), "");
});

test("file names with dots don't end the first sentence early", () => {
  assert.equal(
    describeFile("a.ts", "// Reads docs/architecture.md and CLAUDE.md first.\n"),
    "Reads docs/architecture.md and CLAUDE.md first.",
  );
});

test("JSON files use their description field, or else their first // comment", () => {
  assert.equal(
    describeFile("packages/x/package.json", '{ "name": "x", "description": "The x package." }'),
    "The x package.",
  );
  assert.equal(
    describeFile("packages/x/tsconfig.json", '{\n  // Settings for x.\n  "extends": "../b.json"\n}\n'),
    "Settings for x.",
  );
  assert.equal(describeFile("data.json", '{ "id": 1 }'), "");
});

test("Markdown files use their front-matter description, or else their first heading", () => {
  assert.equal(describeFile("SKILL.md", "---\nname: card\ndescription: Add a card.\n---\n# Heading\n"), "Add a card.");
  assert.equal(describeFile("rules.md", "---\npaths:\n  - x\n---\n# Engine rules\n- one\n"), "Engine rules");
  assert.equal(describeFile("README.md", "Intro\n\n## Usage\n"), "Usage");
});

test("YAML, SQL, shell scripts and extensionless files use their first comment", () => {
  assert.equal(describeFile("ci.yml", "# The CI workflow.\nname: CI\n"), "The CI workflow.");
  assert.equal(
    describeFile("0001.sql", "-- Creates the match table.\ncreate table match ();\n"),
    "Creates the match table.",
  );
  assert.equal(
    describeFile("tools/git-hooks/pre-commit", "#!/bin/sh\n# Formats staged files.\npnpm x\n"),
    "Formats staged files.",
  );
  assert.equal(describeFile("CODEOWNERS", "# Locked: gates\n/a/ @b\n"), "Locked: gates");
  assert.equal(describeFile(".gitignore", "node_modules/\n"), "");
});

test("long descriptions are cut to 160 characters", () => {
  const d = describeFile("a.ts", `// ${"word ".repeat(60)}\n`);
  assert.equal(d.length, 160);
  assert.ok(d.endsWith("…"));
});

test("exportsOf lists exported names in source order", () => {
  const text = [
    "export function createGame() {}",
    "export const apply = 1;",
    "export type Side = 'a';",
    "export interface View {}",
    "const a = 1, b = 2;",
    "export { a, b as renamed };",
    'export type { Decision } from "./d.ts";',
    'export * from "./all.ts";',
    'export * as helpers from "./helpers.ts";',
    "export default 42;",
    "  export const notTopLevel = 1;",
  ].join("\n");
  assert.deepEqual(exportsOf(text), [
    "createGame",
    "apply",
    "Side",
    "View",
    "a",
    "renamed",
    "Decision",
    "* from ./all.ts",
    "helpers",
    "default",
  ]);
  assert.deepEqual(exportsOf("export default function App() {}\n"), ["App"]);
});

test("the map groups files into sections with each package's description as its heading", () => {
  const map = renderMap([
    { path: "README.md", text: "# Readme\n" },
    { path: ".claude/settings.json", text: "{}" },
    { path: "docs/design/a.md", text: "# Design A\n" },
    { path: "packages/engine/package.json", text: '{ "description": "The rules engine." }' },
    { path: "packages/engine/src/index.ts", text: "// Entry point.\nexport const apply = 1;\n" },
    { path: "packages/engine/src/index.test.ts", text: "// Tests.\nexport const helper = 1;\n" },
    { path: "shells/steam/main.ts", text: "// Electron main process.\n" },
    { path: "tests/README.md", text: "# Cross-package suites\n" },
    { path: "tools/x.mjs", text: "// A tool.\n" },
    { path: "unreadable.bin", text: null },
  ]);
  const headings = map.split("\n").filter((l) => l.startsWith("## "));
  assert.deepEqual(headings, [
    "## Root files",
    "## packages/engine - The rules engine.",
    "## shells/steam",
    "## tests",
    "## tools",
    "## docs",
    "## .claude",
  ]);
  assert.match(map, /^- `packages\/engine\/package.json`$/m);
  assert.match(map, /^- `packages\/engine\/src\/index.ts` - Entry point\. Exports: apply\.$/m);
  assert.match(map, /^- `packages\/engine\/src\/index.test.ts` - Tests\.$/m);
  assert.match(map, /^- `unreadable.bin`$/m);
});

test("buildMap lists tracked and new files, skips ignored files and the map itself", () => {
  const repo = tempRepo({ ".gitignore": "secret.txt\n", "docs/repo-map.md": "old\n", "a.ts": "// Tracked file.\n" });
  writeFiles(repo, { "b.ts": "// New file.\n", "secret.txt": "x\n" });
  const map = buildMap(repo);
  assert.match(map, /`a\.ts` - Tracked file\./);
  assert.match(map, /`b\.ts` - New file\./);
  assert.doesNotMatch(map, /secret\.txt|repo-map\.md/);
});

test("buildMap --staged lists only the files in the git index", () => {
  const repo = tempRepo({ "a.ts": "// Tracked file.\n" });
  writeFiles(repo, { "b.ts": "// Staged file.\n", "c.ts": "// Not staged.\n" });
  sh("git", ["add", "b.ts"], repo);
  const map = buildMap(repo, { staged: true });
  assert.match(map, /`b\.ts` - Staged file\./);
  assert.doesNotMatch(map, /c\.ts/);
});
