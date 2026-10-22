// The server's single write path (docs/architecture.md, Decision 5): load the match, run the host, and
// save the result only if nobody moved the match on first. Plain TypeScript; the Edge Function wraps it.
import type { Ruleset, RulesetId } from "@terminal-dusk/engine";
import { hostSubmit } from "@terminal-dusk/host";
import type { HostEffect, HostError, PlayerId, Submission } from "@terminal-dusk/host";
import type { NotifyStore } from "./notifyStore.ts";
import { keepWaiting, queueAlerts } from "./queueAlerts.ts";
import type { LoadedMatch, MatchStore, MatchWrite } from "./store.ts";

/**
 * What the handler needs: where matches live, and the rulesets this server can run, by id. With `notify`,
 * a saved move queues its turn alerts there.
 */
export type SubmitDeps = {
  store: MatchStore;
  ruleset: (id: RulesetId) => Ruleset | undefined;
  notify?: NotifyStore | undefined;
};

/**
 * One call. `player` is the caller's signed-in id; `body` is the wire payload as received: an answer
 * `{ decisionId, expectedSeq, value }` or `{ resign: true }`. Any `player` inside `body` is ignored.
 */
export type SubmitRequest = { matchId: string; player: PlayerId; body: unknown; now: number };

export type ServerErrorCode = "matchNotFound" | "unknownRuleset" | "storageFailed";
export type SubmitError = { code: HostError["code"] | ServerErrorCode; message?: string };
export type SubmitOutcome =
  { ok: true; value: { seq: number; effects: HostEffect[] } } | { ok: false; error: SubmitError };

/**
 * Takes one answer or resignation for one match. Every refusal comes back as an error and saves nothing.
 * It never throws, never changes its inputs, and no result carries anything from the secret.
 */
export async function submit(deps: SubmitDeps, request: SubmitRequest): Promise<SubmitOutcome> {
  const { matchId, player, body, now } = request;
  if (!isPlainObject(body)) return refuse("illegalAnswer", "The answer must be an object.");
  const loaded = await attempt(() => deps.store.load(matchId));
  if (!loaded.ok) return loaded;
  if (loaded.value === null) return refuse("matchNotFound", "There is no match with that id.");
  const { record, secret }: LoadedMatch = loaded.value;
  const ruleset = findRuleset(deps, record.ruleset);
  if (ruleset === undefined) return refuse("unknownRuleset", "This match needs a ruleset the server does not have.");
  const result = hostSubmit(ruleset, record, secret, submissionFrom(body, player), now);
  if (!result.ok) return { ok: false, error: result.error };
  const { effects, ...write } = result.value;
  const committed = await attempt(() => deps.store.commit(matchId, record.seq, write satisfies MatchWrite));
  if (!committed.ok) return committed;
  if (committed.value === "conflict") return refuse("staleSeq", "The game has moved on since that answer was made.");
  await queueAlerts(deps.notify, matchId, write.record.seq, effects, now);
  await keepWaiting(deps.notify, matchId, write, effects);
  return { ok: true, value: { seq: write.record.seq, effects } };
}

/** The host submission with the caller's id. The host checks the rest of the shape itself. */
function submissionFrom(body: Record<string, unknown>, player: PlayerId): Submission {
  if (body.resign === true) return { player, resign: true };
  const { decisionId, expectedSeq, value } = body;
  return { player, decisionId, expectedSeq, value } as Submission;
}

/** The ruleset for `id`, or undefined when the server does not have it (or the lookup fails). */
function findRuleset(deps: SubmitDeps, id: RulesetId): Ruleset | undefined {
  try {
    return deps.ruleset(id);
  } catch {
    return undefined;
  }
}

/** Runs one storage call. A throw or a rejection becomes `storageFailed`, with none of the thrown text. */
async function attempt<T>(call: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: SubmitError }> {
  try {
    return { ok: true, value: await call() };
  } catch {
    return { ok: false, error: { code: "storageFailed", message: "The match could not be read or saved." } };
  }
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const refuse = (code: SubmitError["code"], message: string): SubmitOutcome => ({ ok: false, error: { code, message } });
