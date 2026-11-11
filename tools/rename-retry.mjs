// A rename that waits out Windows' brief locks. Right after a file is written, something on the computer (often
// antivirus scanning it) can hold it for a moment, and a rename then fails with EPERM, EBUSY or EACCES. This
// tries again after 10, 20, 40, 80 and 160ms (310ms at most), then throws the last error. Any other failure,
// such as a missing file, throws at once.
import { renameSync } from "node:fs";

const HELD = new Set(["EPERM", "EBUSY", "EACCES"]);
const WAITS_MS = [10, 20, 40, 80, 160];

// A synchronous pause, so callers stay synchronous.
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** renameSync(from, to), retried while Windows holds a file. `rename` and `wait` are for tests. */
export function renameRetry(from, to, { rename = renameSync, wait = pause } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      rename(from, to);
      return;
    } catch (error) {
      if (!HELD.has(error?.code) || attempt >= WAITS_MS.length) throw error;
      wait(WAITS_MS[attempt]);
    }
  }
}
