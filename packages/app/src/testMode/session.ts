// The state behind the test-mode screen: one local match, the viewer being looked at, that viewer's latest
// frame and game log, and the last refusal. It holds display data only; the rules stay in the host.
import type { AnswerValue, EraId, GameEvent, Viewer } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import { eventPresentation } from "../eventPresentation.ts";
import { toRecording } from "../replay/recording.ts";
import type { ReplayRecording } from "../replay/recording.ts";
import { createLocalMatch } from "../transport/localMatch.ts";
import type { LocalMatch } from "../transport/localMatch.ts";
import { DEFAULT_SEED, fixtureConfig, fixtureRuleset } from "./fixture.ts";

export type Snapshot = {
  viewer: Viewer;
  seed: string;
  /** The viewer's latest frame, or null when the match could not be made. */
  frame: Frame | null;
  /** The game's events as log lines for this viewer, oldest first. */
  log: string[];
  /** The era of the latest eraStarted event in this viewer's log, or null if none yet. */
  era: EraId | null;
  /** The error code of the last refused answer or failed start, or null. */
  refusal: string | null;
  /** True once the game is over and its replay is ready (the replay itself is not in the snapshot). */
  replayReady: boolean;
};

export type TestSession = {
  getSnapshot(): Snapshot;
  subscribe(listener: () => void): () => void;
  setViewer(viewer: Viewer): void;
  /** Starts a fresh match from `seed`, looking at the same viewer. */
  restart(seed: string): void;
  /** The finished game as a recording for the replay viewer, or null while it is not ready. */
  replay(): ReplayRecording | null;
  /** Sends an answer on the current viewer's transport; a refusal shows up in the snapshot. */
  answer(value: AnswerValue): Promise<void>;
};

/** One log line for an event. */
export function logLine(event: GameEvent): string {
  return (eventPresentation[event.kind].log as (e: GameEvent) => string)(event);
}

export function createTestSession(clock: () => number, startSeed: string = DEFAULT_SEED): TestSession {
  const listeners = new Set<() => void>();
  let match: LocalMatch | null = null;
  let stop = (): void => {};
  let logs: Record<Viewer, string[]> = { lio: [], sae: [], spectator: [] };
  let lastSeq: Record<Viewer, number> = { lio: -1, sae: -1, spectator: -1 };
  let eras: Record<Viewer, EraId | null> = { lio: null, sae: null, spectator: null };
  let snapshot: Snapshot = {
    viewer: "lio",
    seed: startSeed,
    frame: null,
    log: [],
    era: null,
    refusal: null,
    replayReady: false,
  };

  const publish = (change: Partial<Snapshot>): void => {
    snapshot = { ...snapshot, ...change };
    for (const listener of [...listeners]) listener();
  };

  const onFrame = (viewer: Viewer, frame: Frame): void => {
    // A frame with the seq already logged (the one a new subscription starts with) adds no lines.
    if (frame.seq > lastSeq[viewer]) {
      logs[viewer] = [...logs[viewer], ...frame.events.map(logLine)];
      lastSeq[viewer] = frame.seq;
      for (const event of frame.events) if (event.kind === "eraStarted") eras[viewer] = event.era;
    }
    publish({ frame, log: logs[viewer], era: eras[viewer], refusal: null, replayReady: match?.archive() != null });
  };

  const watch = (viewer: Viewer): void => {
    stop();
    stop = match ? match.transportFor(viewer).subscribe((frame) => onFrame(viewer, frame)) : () => {};
  };

  const start = (seed: string, viewer: Viewer): void => {
    stop();
    logs = { lio: [], sae: [], spectator: [] };
    lastSeq = { lio: -1, sae: -1, spectator: -1 };
    eras = { lio: null, sae: null, spectator: null };
    const made = createLocalMatch(fixtureRuleset, fixtureConfig, seed, clock);
    match = made.ok ? made.value : null;
    snapshot = {
      viewer,
      seed,
      frame: null,
      log: [],
      era: null,
      refusal: made.ok ? null : made.error.code,
      replayReady: false,
    };
    if (made.ok) watch(viewer);
    else publish({});
  };
  start(startSeed, "lio");

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setViewer(viewer) {
      snapshot = { ...snapshot, viewer, frame: null, log: logs[viewer], era: eras[viewer] };
      watch(viewer);
    },
    replay() {
      const archive = match?.archive();
      return archive ? toRecording(archive) : null;
    },
    restart(seed) {
      start(seed, snapshot.viewer);
    },
    async answer(value) {
      const { frame, viewer } = snapshot;
      const current = match;
      const decision = frame?.decision;
      if (!current || !frame || !decision) return;
      const result = await current
        .transportFor(viewer)
        .submit({ decisionId: decision.id, expectedSeq: frame.seq, value });
      if (current === match && !result.ok) publish({ refusal: result.error.code });
    },
  };
}
