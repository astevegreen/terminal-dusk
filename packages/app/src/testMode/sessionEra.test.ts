// The era in the test-mode session: kept per viewer next to the log, reset by restart.
import type { GameEvent, Viewer } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import { describe, expect, it, vi } from "vitest";
import type { LocalMatch } from "../transport/localMatch.ts";
import { createTestSession } from "./session.ts";

const eraEvent = (era: string): GameEvent => ({ kind: "eraStarted", visibility: "public", era, cardsAdded: 3 });

/** The frame each viewer's fake transport sends instead of the real one, set by the test. */
const replacement: Record<Viewer, ((real: Frame) => Frame) | null> = { lio: null, sae: null, spectator: null };

vi.mock("../transport/localMatch.ts", async () => {
  const actual = await vi.importActual<typeof import("../transport/localMatch.ts")>("../transport/localMatch.ts");
  return {
    createLocalMatch: (...args: Parameters<typeof actual.createLocalMatch>) => {
      const made = actual.createLocalMatch(...args);
      if (!made.ok) return made;
      const real = made.value;
      const fake: LocalMatch = {
        transportFor: (viewer) => {
          const inner = real.transportFor(viewer);
          const change = (frame: Frame): Frame => replacement[viewer]?.(frame) ?? frame;
          return { ...inner, subscribe: (onFrame) => inner.subscribe((frame) => onFrame(change(frame))) };
        },
      };
      return { ok: true, value: fake };
    },
  };
});

const sends = (viewer: Viewer, seq: number, events: GameEvent[]): void => {
  replacement[viewer] = (real) => ({ ...real, seq, events });
};

describe("the session's era", () => {
  it("starts null, becomes the era of an eraStarted event, and is kept per viewer", () => {
    const session = createTestSession(() => 0);
    expect(session.getSnapshot().era).toBeNull();
    sends("sae", 1, [eraEvent("late")]);
    session.setViewer("sae");
    expect(session.getSnapshot().era).toBe("late");
    session.setViewer("lio");
    expect(session.getSnapshot().era).toBeNull();
    session.setViewer("sae");
    expect(session.getSnapshot().era).toBe("late");
  });
  it("keeps the latest of several eraStarted events", () => {
    const session = createTestSession(() => 0);
    sends("lio", 1, [eraEvent("middle"), eraEvent("late")]);
    session.setViewer("sae");
    session.setViewer("lio");
    expect(session.getSnapshot().era).toBe("late");
  });
  it("restart sets it back to null", () => {
    const session = createTestSession(() => 0);
    sends("lio", 1, [eraEvent("late")]);
    session.setViewer("sae");
    session.setViewer("lio");
    expect(session.getSnapshot().era).toBe("late");
    replacement.lio = null;
    session.restart("another");
    expect(session.getSnapshot().era).toBeNull();
  });
});
