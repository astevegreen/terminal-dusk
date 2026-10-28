// Plays one seeded Easy-vs-Easy game of the first deck through the match host, as a real match would run.
// The tool only sees what the host hands out: each side's frame (its view and decision) while the game runs, the
// spectator's frames (the public view and public events) for the map numbers, and the answer log once it is over.
// It never looks inside the game state (hard rule 2).
import { createEasyPlayer, createMediumPlayer } from "@terminal-dusk/ai";
import { hostCreate, hostSubmit } from "@terminal-dusk/host";
import { firstDeckConfig, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { mapSummary } from "./map-stats.mjs";
import { regionLevels } from "./region-stats.mjs";
import { scoreSummary } from "./score-stats.mjs";

export const SIDES = ["lio", "sae"];
/** The AI tiers a side can play as, by name. */
export const TIERS = { easy: createEasyPlayer, medium: createMediumPlayer };
/** A game still going after this many answers stops the run, so a rules loop cannot hang it. */
export const MAX_SUBMISSIONS = 10_000;
/** The host's clock: every step happens at the same moment, which keeps runs identical. */
const NOW = 0;

/** The match seed of game `i` (numbered from 0) in a run with base seed `base`. */
export const matchSeed = (base, i) => `${base}-${i}`;

/**
 * Game `i` of a run: its summary (final status, answer count, answer log, `map`, the map numbers from
 * map-stats.mjs or null when the game has no map, and `eraEnds`, region-stats.mjs's levels at each era's end, in
 * order, empty when the game has no map, and `score`, score-stats.mjs's numbers or null when the map has no scoring).
 * Throws on any refusal, and when a player throws or gives no
 * answer. `config` is the run's match config (see config.mjs); by default the first-deck TEST scenario as it is.
 * `createPlayer(ruleset, side, seed)` makes each side's player; by default the Easy AI. `tiers` (optional,
 * { lio, sae } of TIERS names) picks each side's tier instead; `createPlayer` wins over it. The summary's `crises`
 * counts the escalation crises each side caused.
 */
export function playBalanceGame(base, i, config = firstDeckConfig(), { createPlayer, tiers = {} } = {}) {
  const seed = matchSeed(base, i);
  const fail = (why) => new Error(`Game ${i} (match seed "${seed}"): ${why}`);
  const created = hostCreate(firstDeckRuleset, { ...config, matchId: seed }, seed, NOW);
  if (!created.ok) throw fail(`the host refused to start it: ${describe(created.error)}`);
  let { record, secret, frames } = created.value;
  const publicEvents = [...frames.spectator.events];
  const eras = eraEndTracker(frames.spectator.view.public);
  const scores = scoreTracker(frames.spectator.view.public);
  const players = {
    lio: (createPlayer ?? TIERS[tiers.lio ?? "easy"])(firstDeckRuleset, "lio", 2 * i),
    sae: (createPlayer ?? TIERS[tiers.sae ?? "easy"])(firstDeckRuleset, "sae", 2 * i + 1),
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
      scores.observe(frames.spectator);
      eras.observe(frames.spectator);
      submissions += 1;
      answered = true;
    }
    if (!answered) throw fail("the game is not over but no side has a decision");
  }
  const map = mapSummary(frames.spectator.view.public, publicEvents);
  const eraEnds = eras.finish(frames.spectator.view.public);
  const crises = { lio: 0, sae: 0 };
  for (const event of publicEvents) if (event.kind === "escalationCrisis") crises[event.side] += 1;
  const score = scoreSummary(scores.start, frames.spectator.view.public.score, record.status, scores.rows);
  return { status: record.status, answers: submissions, log: secret.log, map, eraEnds, score, crises };
}

/**
 * Records region-stats.mjs's levels at each era's end, from the spectator's frames. An era ends when the next one
 * starts: the map as it stands then, judged by the ending era's battlegrounds. Tracked only on a scenario with a
 * map (the region levels need one); otherwise `finish` returns an empty list.
 */
function eraEndTracker(start) {
  const eraEnds = [];
  let era = start.map === undefined || start.map === null ? undefined : start.era;
  return {
    observe(spectator) {
      if (era === undefined || !spectator.events.some((event) => event.kind === "eraStarted")) return;
      eraEnds.push({ era, ...regionLevels(spectator.view.public, era) });
      era = spectator.view.public.era;
    },
    finish(pub) {
      if (era !== undefined) eraEnds.push({ era, ...regionLevels(pub, era) });
      return eraEnds;
    },
  };
}

/**
 * Records each region that scores (the regionScored events) with the era it scored for, and the score track's start.
 * An era scores on its last turn, before the next era's cards come in, so a step's scoring belongs to the era the
 * public view had before that step. Without scoring on the map there is no start and no rows.
 */
function scoreTracker(start) {
  const rows = [];
  let era = start.era;
  return {
    start: start.score,
    rows,
    observe(spectator) {
      for (const event of spectator.events) {
        if (event.kind === "regionScored") rows.push({ era, region: event.region, lio: event.lio, sae: event.sae });
      }
      era = spectator.view.public.era;
    },
  };
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
