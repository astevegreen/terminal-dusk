// A lock file for a short read, change and write of a file that several sessions share. Creating `<file>.lock`
// with the "wx" flag succeeds for one process only; the others wait 10ms at a time, for 2 seconds at most, then
// throw. A lock older than 10 seconds belongs to a process that died mid-write (the work it guards takes
// milliseconds), so it is removed and taken over. Two processes that both find the same dead lock at once can
// both go ahead; that needs a crash first, and costs at most one entry, as before the lock.
import { closeSync, openSync, rmSync, statSync } from "node:fs";

const WAIT_MS = 10;
const GIVE_UP_MS = 2000;
const STALE_MS = 10_000;
// Windows refuses to create a file that is being deleted with EPERM, so that counts as held too.
const HELD = new Set(["EEXIST", "EPERM", "EBUSY", "EACCES"]);

// A synchronous pause, so callers stay synchronous.
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function stale(lock, now) {
  try {
    return now() - statSync(lock).mtimeMs > STALE_MS;
  } catch {
    return false;
  }
}

/** Runs `fn` while holding `lock`, and returns what it returns. `wait` and `now` are for tests. */
export function withLock(lock, fn, { wait = pause, now = Date.now } = {}) {
  for (let waited = 0; ;) {
    try {
      closeSync(openSync(lock, "wx"));
      break;
    } catch (error) {
      if (!HELD.has(error?.code)) throw error;
      if (stale(lock, now)) {
        rmSync(lock, { force: true });
        continue;
      }
      if (waited >= GIVE_UP_MS)
        throw Object.assign(new Error(`${lock} is held by another process`), { code: "ELOCKED" });
      wait(WAIT_MS);
      waited += WAIT_MS;
    }
  }
  try {
    return fn();
  } finally {
    rmSync(lock, { force: true });
  }
}
