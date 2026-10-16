import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { runHook, tempRepo, writeFiles } from "./test-helpers.mjs";

const repo = tempRepo({ "package.json": "{\"name\":\"t\",\"private\":true}\n" });
const check = (rel, content) => {
  writeFiles(repo, { [rel]: content });
  return runHook("quick-check.mjs", { cwd: repo, tool_name: "Write", tool_input: { file_path: path.join(repo, rel) } });
};

test("a small, valid file passes silently", () => {
  const r = check("packages/engine/src/small.ts", "export const a = 1;\n");
  assert.equal(r.status, 0);
  assert.equal(r.stderr, "");
});

test("flags code files over 350 lines", () => {
  const r = check("packages/engine/src/big.ts", "export const a = 1;\n".repeat(400));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /packages\/engine\/src\/big\.ts is 401 lines/);
});

test("long Markdown and JSON files are not flagged for size", () => {
  assert.equal(check("docs/design/long.md", "line\n".repeat(400)).status, 0);
});

test("invalid card JSON is reported with its line", () => {
  const r = check("packages/content/cards/early/c1.json", "{\n  \"id\": \"c1\",\n  \"ops\": 3,,\n}\n");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /packages\/content\/cards\/early\/c1\.json:3 /);
});

test("valid card JSON passes when there is no content:check script yet", () => {
  assert.equal(check("packages/content/cards/early/c2.json", "{ \"id\": \"c2\" }\n").status, 0);
});

test("a deleted or missing file is ignored", () => {
  const r = runHook("quick-check.mjs", { cwd: repo, tool_input: { file_path: path.join(repo, "nope.ts") } });
  assert.equal(r.status, 0);
});

test("output to Claude is capped at 20 lines", () => {
  const r = check("packages/engine/src/huge.ts", "x\n".repeat(1000));
  assert.ok(r.stderr.trim().split("\n").length <= 20);
});
