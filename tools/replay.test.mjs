import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

const replay = (...args) =>
  spawnSync(process.execPath, [path.join(import.meta.dirname, "replay.mjs"), ...args], {
    encoding: "utf8",
    windowsHide: true,
  });

test("without a match ID it prints how to use it and fails", () => {
  const r = replay();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Usage: pnpm replay <matchId>/);
});

test("with a match ID it explains that replays are not available yet and fails", () => {
  const r = replay("m-123");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not available yet/);
  assert.match(r.stderr, /m-123/);
});
