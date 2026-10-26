import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearTimer, realTimers, setTimer } from "./timers.ts";

describe("online timers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("an uncleared timer runs once its time has passed, and not before", () => {
    const run = vi.fn();
    setTimer(run, 5_000);
    vi.advanceTimersByTime(4_999);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("a cleared timer never runs", () => {
    const run = vi.fn();
    const handle = setTimer(run, 5_000);
    clearTimer(handle);
    vi.advanceTimersByTime(60_000);
    expect(run).not.toHaveBeenCalled();
  });

  it("clearTimer takes the handle as createRemoteMatch keeps it (unknown) and ignores anything else", () => {
    const run = vi.fn();
    const kept: unknown = realTimers.setTimer(run, 1_000);
    realTimers.clearTimer(kept);
    realTimers.clearTimer(null);
    realTimers.clearTimer(42);
    vi.advanceTimersByTime(2_000);
    expect(run).not.toHaveBeenCalled();
  });
});
