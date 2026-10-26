// Real timers for createRemoteMatch's `setTimer`/`clearTimer` options, over `setTimeout`/`clearTimeout`.
// `setTimer` hands back a small handle object, and `clearTimer` checks that it was given one before clearing,
// so the handle can travel as `unknown` (as createRemoteMatch keeps it) with no unchecked cast anywhere.

/** What `setTimer` returns. Only `clearTimer` looks inside it. */
export class TimerHandle {
  readonly id: ReturnType<typeof setTimeout>;
  constructor(id: ReturnType<typeof setTimeout>) {
    this.id = id;
  }
}

/** Runs `run` once after `ms` milliseconds, unless the returned handle is cleared first. */
export function setTimer(run: () => void, ms: number): TimerHandle {
  return new TimerHandle(setTimeout(run, ms));
}

/** Stops a timer `setTimer` started. Anything else (or a timer that already ran) is ignored. */
export function clearTimer(handle: unknown): void {
  if (handle instanceof TimerHandle) clearTimeout(handle.id);
}

/** The pair createRemoteMatch takes. */
export type Timers = { setTimer: (run: () => void, ms: number) => unknown; clearTimer: (handle: unknown) => void };

export const realTimers: Timers = { setTimer, clearTimer };
