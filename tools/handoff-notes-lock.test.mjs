// recordSession takes a lock file beside the session-ids index while it reads, adds to and renames it, so two
// sessions saving or claiming in the same instant both keep their entries. The rest of handoff-notes is tested in
// handoff-notes.test.mjs; its rename retries in handoff-notes-retry.test.mjs.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { recordSession } from "./handoff-notes.mjs";

const NOW = new Date(2026, 9, 17, 14, 5);
const MODULE = pathToFileURL(path.join(import.meta.dirname, "handoff-notes.mjs")).href;
const configs = [];
after(() => {
  for (const dir of configs) rmSync(dir, { recursive: true, force: true });
});
function configDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "handoff-config-"));
  configs.push(dir);
  return dir;
}
const indexFile = (config) => path.join(config, "session-ids", "handoff.json");
const lockFile = (config) => `${indexFile(config)}.lock`;
const entriesOf = (config) => JSON.parse(readFileSync(indexFile(config), "utf8")).entries;

// One child process that records `count` notes for `session` as fast as it can.
function recorder(config, session, count) {
  const script =
    `const { recordSession } = await import(${JSON.stringify(MODULE)});` +
    `let failed = 0;` +
    `for (let i = 0; i < ${count}; i++) if (!recordSession("wrote", "${session}-" + i + ".md", "s")) failed++;` +
    `process.exit(failed);`;
  const env = { ...process.env, CLAUDE_CODE_SESSION_ID: session, CLAUDE_CONFIG_DIR: config };
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", script], { env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code));
  });
}

test("sessions recording at the same moment all keep their entries", async () => {
  const config = configDir();
  const [sessions, each] = [6, 15];
  const names = Array.from({ length: sessions }, (_, i) => `session-${i}`);
  const failures = await Promise.all(names.map((s) => recorder(config, s, each)));
  assert.deepEqual(
    failures,
    names.map(() => 0),
    "every record reports success",
  );
  const notes = entriesOf(config).map((e) => e.note);
  assert.equal(notes.length, sessions * each, "no entry was lost to another session's write");
  for (const s of names)
    for (let i = 0; i < each; i++) assert.ok(notes.includes(`${s}-${i}.md`), `${s}-${i}.md is in the index`);
  assert.ok(!existsSync(lockFile(config)), "the lock is gone once everyone is done");
});

test("a lock another session holds is waited for, then the record gives up quietly and leaves the index alone", () => {
  const config = configDir();
  const env = { CLAUDE_CODE_SESSION_ID: "session-a", CLAUDE_CONFIG_DIR: config };
  assert.equal(recordSession("wrote", "a.md", "s", { env, now: NOW }), true);
  writeFileSync(lockFile(config), "");
  let waits = 0;
  const wait = () => waits++;
  assert.equal(recordSession("wrote", "b.md", "s", { env, now: NOW, wait }), false);
  assert.ok(waits > 0, "it waited before giving up");
  assert.deepEqual(
    entriesOf(config).map((e) => e.note),
    ["a.md"],
  );
  assert.ok(existsSync(lockFile(config)), "another session's lock is never removed while it is fresh");
});

test("a lock left behind by a session that died is taken over, so one crash never blocks the index for good", () => {
  const config = configDir();
  const env = { CLAUDE_CODE_SESSION_ID: "session-a", CLAUDE_CONFIG_DIR: config };
  mkdirSync(path.dirname(lockFile(config)), { recursive: true });
  writeFileSync(lockFile(config), "");
  const old = new Date(Date.now() - 60_000);
  utimesSync(lockFile(config), old, old);
  assert.equal(recordSession("wrote", "a.md", "s", { env, now: NOW, wait: () => {} }), true);
  assert.deepEqual(
    entriesOf(config).map((e) => e.note),
    ["a.md"],
  );
  assert.ok(!existsSync(lockFile(config)), "the lock is released after the record");
});

test("the lock is released when the record fails", () => {
  const config = configDir();
  const env = { CLAUDE_CODE_SESSION_ID: "session-a", CLAUDE_CONFIG_DIR: config };
  assert.equal(recordSession("wrote", "a.md", "s", { env, now: NOW }), true);
  writeFileSync(indexFile(config), "{ half");
  assert.equal(recordSession("wrote", "b.md", "s", { env, now: NOW }), false);
  assert.ok(!existsSync(lockFile(config)), "a failed record leaves no lock behind");
});
