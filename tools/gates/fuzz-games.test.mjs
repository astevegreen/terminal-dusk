import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { changedSince, fuzzGames, FULL_GAMES, PR_GAMES } from "./fuzz-games.mjs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");

test("a change to anything the fuzz plays or is built from plays the full 10,000 games", () => {
  for (const f of [
    "packages/engine/src/apply.ts",
    "packages/content/cards/era1.json",
    "packages/host/src/matchHost.ts",
    "packages/ai/src/easy.ts",
    "tests/fuzz/checks.ts",
    "tests/golden/refill.test.ts",
    "tools/gates/suites.mjs",
    "tools/gates/fuzz-games.mjs",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.base.json",
  ]) assert.equal(fuzzGames(["docs/x.md", f]), FULL_GAMES, f);
  assert.equal(FULL_GAMES, 10000);
});

test("a change elsewhere plays 2,000 games", () => {
  assert.equal(fuzzGames(["packages/app/src/Board.tsx", "docs/follow-ups.md", ".github/workflows/ci.yml"]), PR_GAMES);
  assert.equal(fuzzGames(["packages/app/package.json", "tools/gates/gate.mjs", "packages/engineering/x.ts"]), PR_GAMES);
  assert.equal(PR_GAMES, 2000);
});

test("when the change can't be read, it plays the full games", () => {
  assert.equal(fuzzGames(null), FULL_GAMES);
  assert.equal(changedSince(ROOT, "not a sha; rm -rf"), null);
  assert.equal(changedSince(ROOT, undefined), null);
  assert.equal(changedSince(ROOT, "0000000000000000000000000000000000000000"), null);
});

test("the command line prints 10000 for --all, and for a base it cannot read", () => {
  const run = (...args) =>
    spawnSync(process.execPath, [path.join(ROOT, "tools/gates/fuzz-games.mjs"), ...args], { encoding: "utf8" }).stdout.trim();
  assert.equal(run("--all"), "10000");
  assert.equal(run(), "10000");
  assert.equal(run("--base", "0000000000000000000000000000000000000000"), "10000");
  // HEAD against itself: nothing changed, so the shorter run.
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).stdout.trim();
  assert.equal(run("--base", head), "2000");
});
