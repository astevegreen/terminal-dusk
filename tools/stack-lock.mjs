// Runs a command while holding the computer's one local Supabase stack, so two folders never use it at once:
// a `supabase db reset` from one would empty the database under the other's stack tests (docs/sprint.md, online).
//   node tools/stack-lock.mjs <command…>   wait for the stack (up to 8 minutes), run the command, let the stack go
// The lock is a file in the temp folder that names who holds it. Its holder touches it every few seconds; a lock
// whose process has ended, or that nobody has touched for 5 minutes, is taken over.
// Exit codes: the command's own, or 1 when no command was given or the stack stayed busy (nothing ran).
// STACK_LOCK_FILE, STACK_LOCK_WAIT_MS and STACK_LOCK_STALE_MS change the file and the two limits (the tests use them).
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  closeSync,
  linkSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

const FILE = process.env.STACK_LOCK_FILE || path.join(os.tmpdir(), "terminal-dusk-stack.lock");
const WAIT_MS = Number(process.env.STACK_LOCK_WAIT_MS) || 8 * 60_000;
const STALE_MS = Number(process.env.STACK_LOCK_STALE_MS) || 5 * 60_000;
const POLL_MS = 250;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The lock as it is now: { raw, holder, age }, or null when there is none. A file still being written has no holder.
function current() {
  try {
    const age = Date.now() - statSync(FILE).mtimeMs;
    const raw = readFileSync(FILE, "utf8");
    let holder = null;
    try {
      holder = JSON.parse(raw);
    } catch {
      // still being written: it counts as held until it is stale
    }
    return { raw, holder, age };
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}

const stale = (lock) => lock.age > STALE_MS || (lock.holder !== null && !alive(lock.holder.pid));

// Creates the lock file only if there is none, so of two runs at the same moment exactly one gets it.
function take(me) {
  let fd;
  try {
    fd = openSync(FILE, "wx");
  } catch (e) {
    if (e.code === "EEXIST") return false;
    throw e;
  }
  try {
    writeSync(fd, JSON.stringify(me));
  } finally {
    closeSync(fd);
  }
  return true;
}

// Moves a stale lock aside and deletes it. When another waiter replaced it first, the newer lock goes back.
// True when the lock is gone, false when it couldn't be moved (it is open elsewhere; try again later).
function breakStale(lock) {
  const aside = `${FILE}.${process.pid}.stale`;
  try {
    renameSync(FILE, aside);
  } catch (e) {
    if (e.code === "ENOENT") return true;
    if (e.code === "EPERM" || e.code === "EBUSY" || e.code === "EACCES") return false;
    throw e;
  }
  if (readFileSync(aside, "utf8") !== lock.raw) {
    try {
      linkSync(aside, FILE);
    } catch {
      // a third run holds the lock by now, so the newer one is lost; its holder stops refreshing it
    }
  }
  rmSync(aside, { force: true });
  return true;
}

const describe = (holder) =>
  holder ? `${holder.folder} is using for "${holder.command}" (since ${holder.started})` : "another run is using";

const command = process.argv.slice(2).join(" ").trim();
if (!command) {
  console.error(
    "usage: node tools/stack-lock.mjs <command…>  (runs the command while holding the local Supabase stack)",
  );
  process.exit(1);
}

const me = { pid: process.pid, token: randomUUID(), folder: process.cwd(), command, started: new Date().toISOString() };
const since = Date.now();
let told = false;
while (!take(me)) {
  const lock = current();
  if (lock === null || (stale(lock) && breakStale(lock))) continue;
  if (Date.now() - since >= WAIT_MS) {
    console.error(
      `stack-lock: gave up after ${Math.round(WAIT_MS / 1000)} s waiting for the local Supabase stack, which ` +
        `${describe(lock.holder)}. "${command}" did not run; run it again once that has finished.`,
    );
    process.exit(1);
  }
  if (!told) console.error(`stack-lock: waiting for the local Supabase stack, which ${describe(lock.holder)}.`);
  told = true;
  await sleep(POLL_MS);
}

const mine = () => current()?.holder?.token === me.token;
const beat = setInterval(
  () => {
    try {
      if (mine()) utimesSync(FILE, new Date(), new Date());
    } catch {
      // gone between the check and the touch: there is nothing left to keep fresh
    }
  },
  Math.max(50, Math.floor(STALE_MS / 4)),
);
const release = () => {
  clearInterval(beat);
  if (mine()) rmSync(FILE, { force: true });
};
process.on("exit", release);

// The command is the package script's own text, never input from a player or the network.
const child = spawn(command, { shell: true, stdio: "inherit", windowsHide: true }); // NOSONAR (javascript:S4721)
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => child.kill(signal));
child.on("error", (e) => {
  console.error(`stack-lock: couldn't start "${command}": ${e.message}`);
  process.exit(1);
});
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
