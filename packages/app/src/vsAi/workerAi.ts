// The real opponent: the Easy AI in a Web Worker. It sends one `start`, then one `answer` request per call,
// and matches each reply to its call by `id`.
import type { AnswerValue, Ruleset, Side } from "@terminal-dusk/engine";
import type { AiOpponent } from "./aiOpponent.ts";

/** The worker's reply (AiResponse in the AI package; repeated here so this file needs only its types). */
type Reply = { kind: "answer"; id: number; value: AnswerValue | null };

export function createWorkerAi(ruleset: Ruleset, side: Side, seed: number): AiOpponent {
  const worker = new Worker(new URL("./ai.worker.ts", import.meta.url), { type: "module" });
  const waiting = new Map<number, (value: AnswerValue | null) => void>();
  let nextId = 1;
  // Set once the worker is ended (stop, or the worker failing): every call after that answers null at once.
  let ended = false;
  const end = (): void => {
    ended = true;
    worker.terminate();
    for (const resolve of waiting.values()) resolve(null);
    waiting.clear();
  };
  worker.onmessage = (event: MessageEvent<Reply>) => {
    const resolve = waiting.get(event.data.id);
    waiting.delete(event.data.id);
    resolve?.(event.data.value);
  };
  // A script that fails to load or throws, or a reply that can't be read, would otherwise leave the game waiting
  // for ever: the answers settle as null, which the session shows as the AI giving no answer.
  worker.onerror = end;
  worker.onmessageerror = end;
  worker.postMessage({ kind: "start", ruleset, side, seed });
  return {
    answer(view) {
      if (ended) return Promise.resolve(null);
      const id = nextId++;
      return new Promise((resolve) => {
        waiting.set(id, resolve);
        worker.postMessage({ kind: "answer", id, view });
      });
    },
    stop: end,
  };
}
