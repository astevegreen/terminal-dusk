// .github/CODEOWNERS names no path, so no change waits for the owner's review (owner's policy, 28 Oct 2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const text = readFileSync(path.join(ROOT, ".github/CODEOWNERS"), "utf8");
const entries = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));

test("CODEOWNERS lists no path, so GitHub's code-owner review never waits for the owner", () => {
  assert.deepEqual(entries, [], "a CODEOWNERS entry makes every change to that path wait for the owner again");
});

test("CODEOWNERS says why it is empty", () => {
  assert.match(text, /No path waits for the owner's review/);
});

test("CODEOWNERS names what holds a loosened rail instead of the owner's review", () => {
  assert.match(text, /held for the owner by agy's rail audit/);
});
