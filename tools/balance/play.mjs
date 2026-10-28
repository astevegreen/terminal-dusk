// Plays one seeded Easy-vs-Easy game of the first deck through the match host, as a real match would run.
// The tool only sees what the host hands out: each side's frame (its view and decision) while the game runs, the
// spectator's frames (the public view and public events) for the map numbers, and the answer log once it is over.
// It never looks inside the game state (hard rule 2).
import { createEasyPlayer } from "@terminal-dusk/ai";
import { hostCreate, hostSubmit } from "@terminal-dusk/host";
import { firstDeckConfig, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { mapSummary } from "./map-stats.mjs";
import { regionLevels } from "./region-stats.mjs";

export const SIDES = ["lio", "sae"];
/** A game still going after this many answers stops the run, so a rules loop cannot hang it. */
export const MAX_SUBMISSIONS = 10_000;
/** The host's clock: every step happens at the same moment, which keeps runs identical. */
const NOW = 0;

/** The match seed of game `i` (numbered from 0) in a run with base seed `base`. */
export const matchSeed = (base, i) => `${base}-${i}`;

/**
 * Game `i` of a run: its summary (final status, answer count, answer log, `map`, the map numbers from
 * map-stats.mjs or null when the game has no map, and `eraEnds`, region-stats.mjs's levels at each era's end, in
 * order, empty when the game has no map). Throws on any refusal, and when a player throws or gives no
 * answer. `config` is the run's match config (see config.mjs); by default the first-deck TEST scenario as it is.
 * `createPlayer(ruleset, side, seed)` makes each side's player; by default the Easy AI.
 */
export function playBalanceGame(base, i, config = firstDeckConfig(), { createPlayer = createEasyPlayer } = {}) {
  const seed = matchSeed(base, i);
  const fail = (why) => new Error(`Game ${i} (match seed "${seed}"): ${why}`);
  const created = hostCreate(firstDeckRuleset, { ...config, matchId: seed }, seed, NOW);
  if (!created.ok) throw fail(`the host refused to start it: ${describe(created.error)}`);
  let { record, secret, frames } = created.value;
  const publicEvents = [...frames.spectator.events];
  const eraEnds = [];
  // The era being played, tracked only on a scenario with a map (the region levels need one).
  const start = frames.spectator.view.public;
  let era = start.map === undefined || start.map === null ? undefined : start.era;
  const players = {
    lio: createPlayer(firstDeckRuleset, "lio", 2 * i),
    sae: createPlayer(firstDeckRuleset, "sae", 2 * i + 1),
  };
  let submissions = 0;
  while (record.status.kind !== "over") {
    let answered = false;
    // LIO first; each answer is built from the frames the latest host result handed out.
    for (const side of SIDES) {
      const decision = frames[side].decision;
      if (decision === null || record.status.kind === "over") continue;
      if (submissions >= MAX_SUBMISSIONS) throw fail(`still going after ${MAX_SUBMISSIONS} answers`);
      const value = answerOf(players[side], frames[side].view, (why) =>
        fail(`the ${side} player ${why} ${about(decision)}`),
      );
      const submission = { player: record.players[side], expectedSeq: record.seq, decisionId: decision.id, value };
      const out = hostSubmit(firstDeckRuleset, record, secret, submission, NOW);
      if (!out.ok) throw fail(`the host refused ${side}'s answer ${JSON.stringify(value)}: ${describe(out.error)}`);
      ({ record, secret, frames } = out.value);
      publicEvents.push(...frames.spectator.events);
      // An era ends when the next one starts: the map as it stands then, judged by the ending era's battlegrounds.
      if (era !== undefined && frames.spectator.events.some((event) => event.kind === "eraStarted")) {
        eraEnds.push({ era, ...regionLevels(frames.spectator.view.public, era) });
        era = frames.spectator.view.public.era;
      }
      submissions += 1;
      answered = true;
    }
    if (!answered) throw fail("the game is not over but no side has a decision");
  }
  const map = mapSummary(frames.spectator.view.public, publicEvents);
  if (era !== undefined) eraEnds.push({ era, ...regionLevels(frames.spectator.view.public, era) });
  return { status: record.status, answers: submissions, log: secret.log, map, eraEnds };
}

/** The player's answer to `view`; a player that throws or answers nothing ends the game with `fail`'s error. */
function answerOf(player, view, fail) {
  let value;
  try {
    value = player(view);
  } catch (err) {
    throw fail(`failed (${err instanceof Error ? err.message : String(err)}) on`);
  }
  if (value === null || value === undefined) throw fail("gave no answer to");
  return value;
}

const about = (decision) => `decision ${decision.id} (${decision.kind})`;
const describe = (error) => `${error.code}${error.message ? ` (${error.message})` : ""}`;
