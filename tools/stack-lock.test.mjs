// stack-lock.mjs lets one folder at a time use the computer's local Supabase stack.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOOL = fileURLToPath(new URL("./stack-lock.mjs", import.meta.url));
const dir = mkdtempSync(path.join(os.tmpdir(), "td-stack-lock-"));
const script = (name, body) => {
  const file = path.join(dir, name);
  writeFileSync(file, body);
  return `node "${file}"`;
};
// `<step> <log> <name> <ms>` writes "<name> start", waits, then writes "<name> end".
const step = script(
  "step.mjs",
  `import { appendFileSync } from "node:fs";
const [log, name, ms] = process.argv.slice(2);
appendFileSync(log, name + " start\\n");
setTimeout(() => appendFileSync(log, name + " end\\n"), Number(ms));`,
);
const exitWith = script("exit.mjs", "process.exit(Number(process.argv[2]));");
// Overwrites the lock as if another run had taken it over.
const steal = script(
  "steal.mjs",
  `import { writeFileSync } from "node:fs";
writeFileSync(process.argv[2], JSON.stringify({ pid: Number(process.argv[3]), token: "other" }));`,
);

let n = 0;
function fresh(limits = {}) {
  n++;
  const lock = path.join(dir, `stack-${n}.lock`);
  const log = path.join(dir, `log-${n}.txt`);
  const env = { ...process.env, STACK_LOCK_FILE: lock, STACK_LOCK_WAIT_MS: "20000", STACK_LOCK_STALE_MS: "60000" };
  for (const [k, v] of Object.entries(limits)) env[`STACK_LOCK_${k}`] = String(v);
  const runSync = (command) =>
    spawnSync(process.execPath, [TOOL, command], { env, encoding: "utf8", windowsHide: true });
  const runAsync = (command) =>
    new Promise((resolve) => {
      const p = spawn(process.execPath, [TOOL, command], { env, windowsHide: true });
      let stderr = "";
      p.stderr.on("data", (d) => (stderr += d));
      p.on("exit", (status) => resolve({ status, stderr }));
    });
  const lines = () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : []);
  return { lock, log, runSync, runAsync, lines };
}

const held = (lock, holder, ageMs = 0) => {
  writeFileSync(
    lock,
    JSON.stringify({
      token: "old",
      folder: "C:/elsewhere",
      command: "pnpm test:stack",
      started: "2026-10-25T01:00:00.000Z",
      ...holder,
    }),
  );
  if (ageMs) {
    const then = new Date(Date.now() - ageMs);
    utimesSync(lock, then, then);
  }
};
const deadPid = () => spawnSync(process.execPath, ["-e", ""]).pid;
const until = async (ok) => {
  for (let i = 0; i < 400 && !ok(); i++) await new Promise((r) => setTimeout(r, 25));
};

test("runs the command, passes its exit code through and leaves no lock behind", () => {
  const t = fresh();
  assert.equal(t.runSync(`${exitWith} 3`).status, 3);
  assert.equal(t.runSync(`${exitWith} 0`).status, 0);
  assert.equal(existsSync(t.lock), false);
});

test("a second run waits until the first has finished, and says what it waits for", async () => {
  const t = fresh();
  const first = t.runAsync(`${step} "${t.log}" A 1500`);
  await until(() => t.lines().includes("A start"));
  const second = await t.runAsync(`${step} "${t.log}" B 0`);
  assert.equal((await first).status, 0);
  assert.equal(second.status, 0);
  assert.deepEqual(t.lines(), ["A start", "A end", "B start", "B end"]);
  assert.match(second.stderr, /waiting for the local Supabase stack/);
  assert.equal(existsSync(t.lock), false);
});

test("keeps its lock fresh, so a run longer than the stale time is never taken over", async () => {
  const t = fresh({ STALE_MS: 800 });
  const first = t.runAsync(`${step} "${t.log}" A 2500`);
  await until(() => t.lines().includes("A start"));
  const second = await t.runAsync(`${step} "${t.log}" B 0`);
  await first;
  assert.equal(second.status, 0);
  assert.deepEqual(t.lines(), ["A start", "A end", "B start", "B end"]);
});

test("a lock whose process has ended is taken over at once", () => {
  const t = fresh({ WAIT_MS: 2000 });
  held(t.lock, { pid: deadPid() });
  assert.equal(t.runSync(`${exitWith} 0`).status, 0);
  assert.equal(existsSync(t.lock), false);
});

test("a lock nobody has refreshed within the stale time is taken over, even if its process id is in use", () => {
  const t = fresh({ WAIT_MS: 2000, STALE_MS: 60000 });
  held(t.lock, { pid: process.pid }, 10 * 60000);
  assert.equal(t.runSync(`${exitWith} 0`).status, 0);
});

test("gives up after the wait limit, names who holds the stack, and doesn't run the command", () => {
  const t = fresh({ WAIT_MS: 600 });
  held(t.lock, { pid: process.pid });
  const r = t.runSync(`${step} "${t.log}" A 0`);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /C:\/elsewhere/);
  assert.match(r.stderr, /pnpm test:stack/);
  assert.deepEqual(t.lines(), []);
  assert.equal(JSON.parse(readFileSync(t.lock, "utf8")).token, "old");
});

test("a lock file that is still being written counts as held", () => {
  const t = fresh({ WAIT_MS: 600 });
  writeFileSync(t.lock, "");
  assert.equal(t.runSync(`${exitWith} 0`).status, 1);
  assert.equal(existsSync(t.lock), true);
});

test("never removes a lock that another run has taken over", () => {
  const t = fresh();
  assert.equal(t.runSync(`${steal} "${t.lock}" ${process.pid}`).status, 0);
  assert.equal(JSON.parse(readFileSync(t.lock, "utf8")).token, "other");
});

test("with no command it says how to use it and runs nothing", () => {
  const r = spawnSync(process.execPath, [TOOL], { encoding: "utf8", windowsHide: true });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /usage/i);
});
