// handoff-notes' two renames (the session index, and a claimed note into done/) wait out Windows' brief locks
// (tools/rename-retry.mjs) instead of failing. The rest of handoff-notes is tested in handoff-notes.test.mjs.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { claim, recordSession, save } from "./handoff-notes.mjs";
import { tempRepo, writeFiles } from "./hooks/test-helpers.mjs";

const NOW = new Date(2026, 9, 17, 14, 5);
const DRAFT =
  "# Handoff: card draw\n(save fills this line)\n\n## Goal\nDraw cards.\n\n## Next\n1. Edit packages/engine/src/draw.ts\n";
const configs = [];
after(() => {
  for (const dir of configs) rmSync(dir, { recursive: true, force: true });
});

// A rename that Windows refuses with `code` twice, then lets through; `calls` counts its tries.
function heldTwice(code) {
  const fake = (from, to) => {
    fake.calls++;
    if (fake.calls < 3) throw Object.assign(new Error(code), { code });
    renameSync(from, to);
  };
  fake.calls = 0;
  return fake;
}

test("recordSession retries a rename that Windows refuses for a moment, instead of dropping the entry", () => {
  const config = mkdtempSync(path.join(os.tmpdir(), "handoff-config-"));
  configs.push(config);
  const env = { CLAUDE_CODE_SESSION_ID: "session-a", CLAUDE_CONFIG_DIR: config };
  const rename = heldTwice("EPERM");
  assert.equal(recordSession("wrote", "a.md", "s", { env, now: NOW, rename }), true);
  assert.equal(rename.calls, 3);
  const index = JSON.parse(readFileSync(path.join(config, "session-ids", "handoff.json"), "utf8"));
  assert.equal(index.entries.length, 1);
});

test("claim waits out a move into done/ that Windows refuses for a moment, instead of saying no such note", () => {
  const repo = tempRepo({ ".gitignore": ".handoff/\n" });
  writeFiles(repo, { ".handoff/card-draw.md": DRAFT });
  assert.equal(save(".handoff/card-draw.md", { cwd: repo, now: NOW }).code, 0);
  const name = "2026-10-17-1405-card-draw.md";
  const rename = heldTwice("EBUSY");
  assert.equal(claim(name, { cwd: repo, rename }).code, 0);
  assert.equal(rename.calls, 3);
  assert.deepEqual(readdirSync(path.join(repo, ".handoff", "done")), [name]);
});
