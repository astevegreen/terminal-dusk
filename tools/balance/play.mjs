// Plays one seeded Easy-vs-Easy game of the first deck through the match host, as a real match would run.
// The tool only sees what the host hands out: each side's frame (its view and decision) while the game runs,
// and the answer log once it is over. It never looks inside the game state (hard rule 2).
import { createEasyPlayer } from "@terminal-dusk/ai";
import { hostCreate, hostSubmit } from "@terminal-dusk/host";
import { firstDeckConfig, firstDeckRuleset } from "@terminal-dusk/host/first-deck";

export const SIDES = ["lio", "sae"];
/** A game still going after this many answers stops the run, so a rules loop cannot hang it. */
export const MAX_SUBMISSIONS = 10_000;
/** The host's clock: every step happens at the same moment, which keeps runs identical. */
const NOW = 0;

/** The match seed of game `i` (numbered from 0) in a run with base seed `base`. */
export const matchSeed = (base, i) => `${base}-${i}`;

/**
 * Game `i` of a run: its summary (final status, answer count and answer log). Throws on any refusal. `config` is
 * the run's match config (config.mjs), the first-deck TEST scenario's by default.
 */
export function playBalanceGame(base, i, config = firstDeckConfig()) {
  const seed = matchSeed(base, i);
  const fail = (why) => new Error(`Game ${i} (match seed "${seed}"): ${why}`);
  const created = hostCreate(firstDeckRuleset, { ...config, matchId: seed }, seed, NOW);
  if (!created.ok) throw fail(`the host refused to start it: ${describe(created.error)}`);
  let { record, secret, frames } = created.value;
  const players = {
    lio: createEasyPlayer(firstDeckRuleset, "lio", 2 * i),
    sae: createEasyPlayer(firstDeckRuleset, "sae", 2 * i + 1),
  };
  let submissions = 0;
  while (record.status.kind !== "over") {
    let answered = false;
    // LIO first; each answer is built from the frames the latest host result handed out.
    for (const side of SIDES) {
      const decision = frames[side].decision;
      if (decision === null || record.status.kind === "over") continue;
      if (submissions >= MAX_SUBMISSIONS) throw fail(`still going after ${MAX_SUBMISSIONS} answers`);
      const value = players[side](frames[side].view);
      if (value === null) throw fail(`the ${side} Easy player gave no answer to decision ${decision.id}`);
      const submission = { player: record.players[side], expectedSeq: record.seq, decisionId: decision.id, value };
      const out = hostSubmit(firstDeckRuleset, record, secret, submission, NOW);
      if (!out.ok) throw fail(`the host refused ${side}'s answer ${JSON.stringify(value)}: ${describe(out.error)}`);
      ({ record, secret, frames } = out.value);
      submissions += 1;
      answered = true;
    }
    if (!answered) throw fail("the game is not over but no side has a decision");
  }
  return { status: record.status, answers: submissions, log: secret.log };
}

const describe = (error) => `${error.code}${error.message ? ` (${error.message})` : ""}`;
