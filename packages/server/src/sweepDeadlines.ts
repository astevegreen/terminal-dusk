// The deadline sweep (docs/architecture.md, Decision 5, "Scheduled jobs", Deadlines): for every match
// past a deadline, apply its deadline rule through the host and save the result with the same seq check
// as `submit`. Plain TypeScript; the scheduled job that calls it every minute is a later task.
import type { Ruleset, RulesetId } from "@terminal-dusk/engine";
import { hostDeadline } from "@terminal-dusk/host";
import type { DeadlineStore } from "./deadlineStore.ts";
import { commitStep } from "./finalize.ts";
import type { LoadedMatch, MatchStore, MatchWrite, SaveResult } from "./store.ts";

/**
 * One due match's outcome. `extended`: a grace extension was saved. `timedOut`: the deadline step that was saved
 * ended the game: a loss or a draw on time, or default answers that finished it (#616). `answered`: under the
 * "defaultAnswer" rule the host's default answers for the late side were saved, and the game goes on (#605).
 * `conflict`: the stored seq moved on first, so nothing was written. `skipped`: no step was written, with
 * the host's refusal code (for example `notDue`), or `unknownRuleset`, `notFound` or `storageFailed`. A stand-in
 * that finds no legal answer ends the game in a draw on time, so it is `timedOut` (#629).
 */
export type SweepResult = { matchId: string } & (
  { status: "extended" | "timedOut" | "answered" | "conflict" } | { status: "skipped"; code: string }
);

/**
 * Applies the deadline rule to every match `store.due(now)` gives, one at a time in that order, and
 * returns one result per match. One match's refusal or storage failure never stops the sweep, and the
 * sweep never throws. Running it twice at the same `now` changes nothing the second time.
 */
export async function sweepDeadlines(
  store: MatchStore & DeadlineStore,
  rulesetFor: (id: RulesetId) => Ruleset | null,
  now: number,
): Promise<SweepResult[]> {
  const due = await attempt(() => store.due(now));
  if (!due.ok) return [];
  const results: SweepResult[] = [];
  for (const matchId of due.value) results.push(await sweepOne(store, rulesetFor, matchId, now));
  return results;
}

async function sweepOne(
  store: MatchStore & DeadlineStore,
  rulesetFor: (id: RulesetId) => Ruleset | null,
  matchId: string,
  now: number,
): Promise<SweepResult> {
  const skip = (code: string): SweepResult => ({ matchId, status: "skipped", code });
  const loaded = await attempt<LoadedMatch | null>(() => store.load(matchId));
  if (!loaded.ok) return skip("storageFailed");
  if (loaded.value === null) return skip("notFound");
  const { record, secret } = loaded.value;
  const ruleset = findRuleset(rulesetFor, record.ruleset);
  if (ruleset === null) return skip("unknownRuleset");
  const result = hostDeadline(ruleset, record, secret, now);
  if (!result.ok) return skip(result.error.code);
  const write: MatchWrite = { record: result.value.record, secret: result.value.secret, frames: result.value.frames };
  // An extension keeps the seq (the game has not moved on); a loss or draw on time or a stand-in is an accepted step.
  const extended = write.record.seq === record.seq;
  const saved = await attempt<SaveResult>(() =>
    extended ? store.saveClock(matchId, record.seq, write.record) : commitStep(store, record, write, now),
  );
  if (!saved.ok) return skip("storageFailed");
  if (saved.value === "conflict") return { matchId, status: "conflict" };
  if (extended) return { matchId, status: "extended" };
  if (write.record.status.kind === "over") return { matchId, status: "timedOut" };
  return { matchId, status: write.frames.lio.standIn === undefined ? "timedOut" : "answered" };
}

/** The ruleset for `id`, or null when the server does not have it (or the lookup throws). */
function findRuleset(rulesetFor: (id: RulesetId) => Ruleset | null, id: RulesetId): Ruleset | null {
  try {
    return rulesetFor(id) ?? null;
  } catch {
    return null;
  }
}

/** Runs one storage call. A throw or a rejection becomes `{ ok: false }`, with none of the thrown text. */
async function attempt<T>(call: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await call() };
  } catch {
    return { ok: false };
  }
}
