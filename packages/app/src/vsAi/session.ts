// The state behind a game against the AI: one local match on the developer fixture, the human's latest frame
// and log, and the AI side's frames, which the session answers through the AI opponent. It holds display data
// only; the rules stay in the host, and the AI sees only its own side's view.
import type { AnswerValue, EraId, Ruleset, Seed, Side } from "@terminal-dusk/engine";
import type { Frame, HostError } from "@terminal-dusk/host";
import { fixtureConfig, fixtureRuleset } from "../testMode/fixture.ts";
import { logLine } from "../testMode/session.ts";
import { toRecording } from "../replay/recording.ts";
import type { ReplayRecording } from "../replay/recording.ts";
import { createLocalMatch } from "../transport/localMatch.ts";
import type { LocalMatch } from "../transport/localMatch.ts";
import type { MakeAi } from "./aiOpponent.ts";

export type VsAiSnapshot = {
  human: Side;
  /** The human's latest frame, or null when the match could not be made. */
  frame: Frame | null;
  /** The game's events as log lines for the human, oldest first. */
  log: string[];
  /** The era of the latest eraStarted event in the human's log, or null if none yet. */
  era: EraId | null;
  /** The error code of the human's last refused answer or of a failed start, or null. */
  refusal: string | null;
  /** The error code of a refused AI answer (a bug to report), or null. Once set, the AI is stopped. */
  aiRefusal: string | null;
  /** True once the game is over and its replay is ready (the replay itself is not in the snapshot). */
  replayReady: boolean;
};

export type VsAiOptions = {
  human: Side;
  gameSeed: Seed;
  aiSeed: number;
  clock: () => number;
  makeAi: MakeAi;
  /** The rules the match and the AI use; the developer fixture when left out. Must fit what makeMatch makes. */
  ruleset?: Ruleset;
  /** Makes the match; the developer fixture when left out. Tests use it to watch the transports. */
  makeMatch?: (seed: Seed, clock: () => number) => { ok: true; value: LocalMatch } | { ok: false; error: HostError };
};

export type VsAiSession = {
  getSnapshot(): VsAiSnapshot;
  subscribe(listener: () => void): () => void;
  /** Sends the human's answer; a refusal shows up in the snapshot. */
  answer(value: AnswerValue): Promise<void>;
  /** The finished game as a recording for the replay viewer, or null while it is not ready. */
  replay(): ReplayRecording | null;
  /** Stops the AI and the session. Nothing is asked or sent afterwards. */
  stop(): void;
};

const fixtureMatch = (seed: Seed, clock: () => number) => createLocalMatch(fixtureRuleset, fixtureConfig, seed, clock);

/** The code shown when the AI gives no answer to a decision it was asked about. */
export const NO_ANSWER = "noAnswer";

export function createVsAiSession(options: VsAiOptions): VsAiSession {
  const { human, clock } = options;
  const aiSide: Side = human === "lio" ? "sae" : "lio";
  const listeners = new Set<() => void>();
  let snapshot: VsAiSnapshot = {
    human,
    frame: null,
    log: [],
    era: null,
    refusal: null,
    aiRefusal: null,
    replayReady: false,
  };
  const publish = (change: Partial<VsAiSnapshot>): void => {
    snapshot = { ...snapshot, ...change };
    for (const listener of [...listeners]) listener();
  };
  const base = {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  const made = (options.makeMatch ?? fixtureMatch)(options.gameSeed, clock);
  if (!made.ok) {
    snapshot = { ...snapshot, refusal: made.error.code };
    return { ...base, answer: () => Promise.resolve(), replay: () => null, stop: () => {} };
  }
  const humanTransport = made.value.transportFor(human);
  const aiTransport = made.value.transportFor(aiSide);
  const ai = options.makeAi(options.ruleset ?? fixtureRuleset, aiSide, options.aiSeed);
  let stopped = false;
  let aiStopped = false;
  let lastSeq = -1;
  const asked = new Set<string>();
  let aiFrame: Frame | null = null;

  const stopAi = (): void => {
    if (aiStopped) return;
    aiStopped = true;
    ai.stop();
  };

  const onHumanFrame = (frame: Frame): void => {
    // A frame with the seq already logged (the one a subscription starts with) adds no lines.
    let { log, era } = snapshot;
    if (frame.seq > lastSeq) {
      log = [...log, ...frame.events.map(logLine)];
      lastSeq = frame.seq;
      for (const event of frame.events) if (event.kind === "eraStarted") era = event.era;
    }
    publish({ frame, log, era, refusal: null, replayReady: made.value.archive() !== null });
  };

  // Sends the AI's answer to `decisionId` if the AI's latest frame still waits on it. A stale seq means a newer
  // frame arrived while the answer was queued, so it is checked again against that frame.
  const send = async (decisionId: string, value: AnswerValue | null): Promise<void> => {
    for (;;) {
      const latest = aiFrame;
      if (aiStopped || !latest || latest.decision?.id !== decisionId) return;
      if (value === null) {
        publish({ aiRefusal: NO_ANSWER });
        stopAi();
        return;
      }
      const result = await aiTransport.submit({ decisionId, expectedSeq: latest.seq, value });
      if (result.ok) return;
      if (result.error.code === "staleSeq" && aiFrame !== latest) continue;
      if (!aiStopped) publish({ aiRefusal: result.error.code });
      stopAi();
      return;
    }
  };

  // The AI is asked once per decision, so its answers depend only on the seeds and the human's answers.
  const onAiFrame = (frame: Frame): void => {
    aiFrame = frame;
    const decision = frame.decision;
    if (aiStopped || !decision || frame.view.public.status.kind !== "active" || asked.has(decision.id)) return;
    asked.add(decision.id);
    void ai.answer(frame.view).then((value) => send(decision.id, value));
  };

  const unsubscribeHuman = humanTransport.subscribe(onHumanFrame);
  const unsubscribeAi = aiTransport.subscribe(onAiFrame);

  return {
    ...base,
    async answer(value) {
      const { frame } = snapshot;
      const decision = frame?.decision;
      if (stopped || !frame || !decision) return;
      // A new answer clears the last refusal, so a repeated refusal shows again rather than looking unchanged.
      if (snapshot.refusal !== null) publish({ refusal: null });
      const result = await humanTransport.submit({ decisionId: decision.id, expectedSeq: frame.seq, value });
      if (!stopped && !result.ok) publish({ refusal: result.error.code });
    },
    replay() {
      const archive = made.value.archive();
      return archive ? toRecording(archive) : null;
    },
    stop() {
      stopped = true;
      stopAi();
      unsubscribeHuman();
      unsubscribeAi();
    },
  };
}
