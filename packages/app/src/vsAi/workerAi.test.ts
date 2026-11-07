import { createAiWorkerHandler, createEasyPlayer } from "@terminal-dusk/ai";
import type { AiRequest, AiResponse } from "@terminal-dusk/ai";
import type { PlayerView } from "@terminal-dusk/engine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureConfig, fixtureRuleset } from "../testMode/fixture.ts";
import { createLocalMatch } from "../transport/localMatch.ts";
import { createWorkerAi } from "./workerAi.ts";

/** Stands in for the browser's Worker: runs the AI's handler in-process and replies in reverse order. */
class FakeWorker {
  static made: FakeWorker[] = [];
  url: string;
  options: unknown;
  sent: AiRequest[] = [];
  terminated = false;
  onmessage: ((event: { data: AiResponse }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessageerror: ((event: unknown) => void) | null = null;
  private readonly handle = createAiWorkerHandler();
  private replies: AiResponse[] = [];
  constructor(url: URL, options: unknown) {
    this.url = url.href;
    this.options = options;
    FakeWorker.made.push(this);
  }
  postMessage(request: AiRequest) {
    this.sent.push(request);
    const reply = this.handle(request);
    if (reply) this.replies.push(reply);
  }
  /** Delivers the replies so far, newest first. */
  flush() {
    const now = this.replies.reverse();
    this.replies = [];
    for (const data of now) this.onmessage?.({ data });
  }
  terminate() {
    this.terminated = true;
  }
}

function firstView(): PlayerView {
  const made = createLocalMatch(fixtureRuleset, fixtureConfig, "worker-test", () => 1_700_000_000_000);
  if (!made.ok) throw new Error(made.error.code);
  let view: PlayerView | null = null;
  made.value.transportFor("sae").subscribe((frame) => (view = frame.view))();
  if (!view) throw new Error("no frame");
  return view;
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeWorker.made = [];
});

describe("the Web Worker opponent", () => {
  it("starts a module worker from ai.worker.ts and sends it the ruleset, side and seed", () => {
    vi.stubGlobal("Worker", FakeWorker);
    createWorkerAi(fixtureRuleset, "sae", 42);
    const [worker] = FakeWorker.made;
    expect(worker?.url).toMatch(/ai\.worker\.ts$/);
    expect(worker?.options).toEqual({ type: "module" });
    expect(worker?.sent).toEqual([{ kind: "start", ruleset: fixtureRuleset, side: "sae", seed: 42 }]);
  });

  it("sends one answer request per call and matches each reply to its call by id", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const ai = createWorkerAi(fixtureRuleset, "sae", 42);
    const view = firstView();
    const first = ai.answer(view);
    const second = ai.answer(view);
    FakeWorker.made[0]?.flush();
    const player = createEasyPlayer(fixtureRuleset, "sae", 42);
    const [one, two] = [player(view), player(view)];
    // The two answers differ, so a reply given to the wrong call (they arrive in reverse order) would be caught.
    expect(one).not.toEqual(two);
    expect(await first).toEqual(one);
    expect(await second).toEqual(two);
    const ids = FakeWorker.made[0]?.sent.flatMap((r) => (r.kind === "answer" ? [r.id] : []));
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it("stop() ends the worker and drops answers still on their way", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const ai = createWorkerAi(fixtureRuleset, "sae", 42);
    const pending = ai.answer(firstView());
    ai.stop();
    expect(FakeWorker.made[0]?.terminated).toBe(true);
    expect(await pending).toBeNull();
  });

  for (const failure of ["onerror", "onmessageerror"] as const) {
    it(`a worker ${failure.slice(2)} settles every waiting answer as null, ends the worker, and later calls give null`, async () => {
      vi.stubGlobal("Worker", FakeWorker);
      const ai = createWorkerAi(fixtureRuleset, "sae", 42);
      const pending = ai.answer(firstView());
      const worker = FakeWorker.made[0]!;
      worker[failure]?.({ message: "the AI script failed" });
      expect(await pending).toBeNull();
      expect(worker.terminated).toBe(true);
      const sentBefore = worker.sent.length;
      expect(await ai.answer(firstView())).toBeNull();
      expect(worker.sent).toHaveLength(sentBefore);
    });
  }
});
