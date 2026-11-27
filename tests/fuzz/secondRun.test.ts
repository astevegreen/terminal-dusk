// A failing fuzz game plays its own record a second time, and its report says whether the failure repeats (#617).
// Each game is fixed by its record, so a failure that does not repeat is a fault in the machine or the test run,
// not in the rules. Extra-steps game 188 failed once like that (21 Nov 2026, the PC loaded by a balance run) and
// passed on every rerun; the gate's short output had dropped the record, so nothing could tell which it was.
import { describe, expect, it } from "vitest";
import type { Answer, Ruleset } from "@terminal-dusk/engine";
import { playFuzzGame, playGame, playRecorded, randomGame, ruleset, secondRun } from "./play.ts";
import type { GameRecord } from "./play.ts";
import { seededRng } from "./random.ts";

const reportOf = (run: () => unknown): string => {
  try {
    run();
  } catch (err) {
    return String(err);
  }
  throw new Error("the game did not fail");
};

const firstLine = (report: string): string => report.split("\n")[0]!;

/** The base fuzz ruleset, but reading any of its fields throws once: on read number `at`, and never after. */
function failingOnce(at: number): Ruleset {
  let reads = 0;
  return new Proxy(ruleset, {
    get(target, key, receiver) {
      if (++reads === at) throw new Error("a one-off fault");
      return Reflect.get(target, key, receiver) as unknown;
    },
  });
}

/** The base fuzz ruleset, counting reads of its fields in `reads.n`; from read `every` on, every `every`th throws. */
function failingEvery(every: number, reads = { n: 0 }): Ruleset {
  return new Proxy(ruleset, {
    get(target, key, receiver) {
      if (++reads.n % every === 0) throw new Error("a fault at the record's end");
      return Reflect.get(target, key, receiver) as unknown;
    },
  });
}

const bad: Answer = {
  decisionId: "no-such-decision",
  side: "lio",
  value: { kind: "playCardAs", card: "c1", as: "event" },
};
const badRecord: GameRecord = { setup: randomGame(seededRng(3), 3).setup, seed: "fuzz-3", answers: [bad] };

describe("a failing fuzz game is played again from its record", () => {
  it("a rules failure says, on the report's first line, that it repeats", () => {
    expect(firstLine(reportOf(() => playRecorded("bad answer", badRecord)))).toMatch(
      /^Error: Fixed game "bad answer" failed at answer 1 \(it fails the same way when its record is played again\): apply refused/,
    );
  });

  it("a fault that happens once is reported as not repeated, with the game's record", () => {
    // Fuzz game 1 replayed answer by answer, with a ruleset that throws on one read during the first run only.
    const { record } = playFuzzGame(1);
    let next = 0;
    const report = reportOf(() =>
      playGame(failingOnce(500), "Once", record.setup, record.seed, () => record.answers[next++] ?? null),
    );
    expect(firstLine(report)).toMatch(
      /^Error: Once failed at answer \d+ \(NOT REPEATED: played again from its record it passes, so suspect the machine or test run, not the rules\): .*a one-off fault/,
    );
    expect(report).toContain(`Seed: ${JSON.stringify(record.seed)}`);
  });

  it("secondRun tells a repeat from a different failure and from a pass", () => {
    const message = reportOf(() => playRecorded("bad answer", badRecord))
      .split("): ")[1]!
      .split("\n")[0]!;
    expect(secondRun(ruleset, badRecord, message)).toBe("it fails the same way when its record is played again");
    expect(secondRun(ruleset, badRecord, "something else")).toMatch(
      /^played again from its record it fails differently: apply refused .*unknownDecision/,
    );
    expect(secondRun(ruleset, playFuzzGame(1).record, "something else")).toMatch(/^NOT REPEATED/);
  });

  it("the same message at a different answer is not the same failure", () => {
    const message = reportOf(() => playRecorded("bad answer", badRecord))
      .split("): ")[1]!
      .split("\n")[0]!;
    // Recorded as failing at answer 2, the same refusal comes back at answer 1 instead.
    const twice: GameRecord = { ...badRecord, answers: [bad, bad] };
    expect(secondRun(ruleset, twice, message)).toBe(
      "played again from its record it fails with the same message, but at answer 1, not at answer 2",
    );
  });

  it("a failure after the record's last answer repeats at that answer, not one past it", () => {
    // Fuzz game 1 cut to 10 answers, so the game is still going: once they run out, the end-of-game checks fail.
    const { setup, seed, answers } = playFuzzGame(1).record;
    const short: GameRecord = { setup, seed, answers: answers.slice(0, 10) };
    const chooser = (): (() => Answer | null) => {
      let next = 0;
      return () => short.answers[next++] ?? null;
    };
    // A whole run's reads; failing on the last of them fails the first run and its second run at the same point.
    const reads = { n: 0 };
    playGame(failingEvery(Number.MAX_SAFE_INTEGER, reads), "Count", setup, seed, chooser());
    const report = reportOf(() => playGame(failingEvery(reads.n), "End", setup, seed, chooser()));
    expect(firstLine(report)).toMatch(
      /^Error: End failed at answer 10 \(it fails the same way when its record is played again\): .*a fault at the record's end/,
    );
  });

  it("a failure while picking an answer is not played again, and says so", () => {
    const { setup, seed } = randomGame(seededRng(5), 5);
    const report = reportOf(() =>
      playGame(ruleset, "Picker", setup, seed, () => {
        throw new Error("the picker broke");
      }),
    );
    expect(firstLine(report)).toBe(
      "Error: Picker failed at the start (it failed while picking an answer, so its record was not played again): the picker broke",
    );
  });
});
