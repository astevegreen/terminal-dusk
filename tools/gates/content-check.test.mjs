import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkContent, contentFolderOf, listContentFiles } from "./content-check.mjs";
import { writeFiles } from "../hooks/test-helpers.mjs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const tempRoot = (files) => {
  const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), "td-content-")));
  writeFiles(dir, files);
  return dir;
};

// A stand-in for a Zod schema: cards need a string id.
const cards = {
  safeParse: (d) =>
    typeof d?.id === "string"
      ? { success: true }
      : { success: false, error: { issues: [{ path: ["id"], message: "Expected a string" }] } },
};

test("content files are the JSON files in a content folder of packages/content", () => {
  assert.equal(contentFolderOf("packages/content/cards/early/c1.json"), "cards");
  assert.equal(contentFolderOf("packages/content/scenarios/standard.json"), "scenarios");
  assert.equal(contentFolderOf("packages/content/package.json"), null);
  assert.equal(contentFolderOf("packages/content/tsconfig.json"), null);
  assert.equal(contentFolderOf("packages/content/schema/fixture.json"), null);
  assert.equal(contentFolderOf("packages/content/cards/early/c1.test.ts"), null);
  assert.equal(contentFolderOf("packages/engine/cards/c1.json"), null);
});

test("a content file that matches its schema passes", () => {
  const root = tempRoot({ "packages/content/cards/early/c1.json": '{ "id": "c1" }' });
  assert.deepEqual(checkContent(root, listContentFiles(root), { cards }), []);
});

test("schema problems are reported with the file, line and field", () => {
  const root = tempRoot({ "packages/content/cards/early/c2.json": '{\n  "ops": 3,\n  "id": 2\n}\n' });
  assert.deepEqual(checkContent(root, ["packages/content/cards/early/c2.json"], { cards }), [
    "packages/content/cards/early/c2.json:3 id: Expected a string",
  ]);
});

test("invalid JSON is reported with its line", () => {
  const root = tempRoot({ "packages/content/cards/early/c3.json": '{\n  "id": "c3",,\n}\n' });
  const [problem] = checkContent(root, ["packages/content/cards/early/c3.json"], { cards });
  assert.match(problem, /^packages\/content\/cards\/early\/c3\.json:2 is not valid JSON/);
});

test("content in a folder without a schema is rejected", () => {
  const root = tempRoot({ "packages/content/scenarios/standard.json": "{}" });
  assert.deepEqual(checkContent(root, listContentFiles(root), { cards }), [
    "packages/content/scenarios/standard.json:1 has no schema: add schemas.scenarios to packages/content/schema/index.ts before adding scenarios content.",
  ]);
});

test("files that are not content are ignored, even when named explicitly", () => {
  const root = tempRoot({ "packages/content/package.json": "not json", "packages/content/schema/x.json": "{" });
  assert.deepEqual(checkContent(root, ["packages/content/package.json", "packages/content/schema/x.json"], {}), []);
});

test("the real check loads the repository's schemas and passes on the current content", () => {
  for (const args of [[], ["packages/content/package.json"]]) {
    const r = spawnSync(process.execPath, ["tools/gates/content-check.mjs", ...args], {
      cwd: ROOT, encoding: "utf8", windowsHide: true,
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(r.stdout + r.stderr, "");
  }
});
