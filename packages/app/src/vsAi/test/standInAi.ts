// Test helper: an opponent that calls the Easy AI directly instead of through a Web Worker. It counts what it
// is asked, can hold its replies until the test releases them, and can be told to give a wrong answer.
import { createEasyPlayer } from "@terminal-dusk/ai";
import type { AnswerValue, PlayerView } from "@terminal-dusk/engine";
import type { MakeAi } from "../aiOpponent.ts";

export type StandInOptions = {
  /** Replies wait until `release()` is called. */
  hold?: boolean;
  /** Replaces the AI's answer, e.g. with one the host refuses. */
  override?: (view: PlayerView) => AnswerValue | null;
};

export type StandIn = {
  makeAi: MakeAi;
  /** The id of the AI side's waiting decision in each view it was asked about, in order. */
  asked: string[];
  /** Every answer it gave, in order. */
  answers: (AnswerValue | null)[];
  stops: number;
  /** Sends every held reply. Returns how many there were. */
  release(): number;
};

export function standInAi(options: StandInOptions = {}): StandIn {
  let held: (() => void)[] = [];
  const standIn: StandIn = {
    asked: [],
    answers: [],
    stops: 0,
    release() {
      const now = held;
      held = [];
      for (const send of now) send();
      return now.length;
    },
    makeAi(ruleset, side, seed) {
      const player = createEasyPlayer(ruleset, side, seed);
      return {
        answer(view) {
          standIn.asked.push(view.public.pending.find((d) => d.side === side)?.id ?? "none");
          const value = options.override ? options.override(view) : player(view);
          standIn.answers.push(value);
          if (!options.hold) return Promise.resolve(value);
          return new Promise((resolve) => held.push(() => resolve(value)));
        },
        stop() {
          standIn.stops++;
        },
      };
    },
  };
  return standIn;
}
