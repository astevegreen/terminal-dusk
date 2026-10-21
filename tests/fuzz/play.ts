// Plays one game for the fuzz suite, random or recorded, and checks every invariant along the way.
// A failing game throws a report with its seed and answers, ready to keep in fixedGames.ts.
import { easyAnswer, EASY_WEIGHTS } from "@terminal-dusk/ai";
import { apply, createGame, legalAnswers, pendingFor, seedHash, SIDES, viewFor } from "@terminal-dusk/engine";
import type {
  Answer,
  AnswerValue,
  CardId,
  Decision,
  EraEntry,
  GameEvent,
  GameState,
  Ruleset,
  Seed,
  Setup,
  Side,
} from "@terminal-dusk/engine";
import { FUZZ_CARDS, MAX_ERA_CARDS, MAX_EXTRA, MAX_PILE, MAX_PLAYS, MAX_TURNS, ruleset } from "./cards.ts";
import { attempt, checkStep, checkVerify, firstDifference, knowledgeOf } from "./checks.ts";
import { deepFreeze } from "./deepFreeze.ts";
import { checkTriggerFilters } from "./filterChecks.ts";
import { checkPlayedBy, notePlay } from "./playedBy.ts";
import type { PlayRecord } from "./playedBy.ts";
import { checkPlayerDraws, notePlayer } from "./playerDraws.ts";
import { seededRng } from "./random.ts";
import type { Rng } from "./random.ts";

// The fuzz cards live in cards.ts; the tests import them from here, as before the split.
export { baseEffectOf, FUZZ_CARDS, ruleset } from "./cards.ts";

/** Fewest and most cards in a random Contingency deck, and the highest number on one. */
const MIN_DECK = 3;
const MAX_DECK = 8;
const MAX_NUMBER = 12;
/** Most cards a random hand size has beyond the smallest, 1 + plays per turn. */
const MAX_HAND_EXTRA = 4;
/** The default Contingency deck (docs/design/contingency-deck.md), which about one random deck in four is. */
const DEFAULT_DECK: readonly number[] = [1, 2, 3, 4, 5, 6];
const neutral = new Set(ruleset.cards.filter((card) => card.affiliation === "neutral").map((card) => card.id));
/** Games played when FUZZ_GAMES is unset, as in `pnpm test`-style runs of this folder. */
export const DEFAULT_GAMES = 100;
/** A game still going after this many answers fails, so a rules loop can't hang the suite. */
export const MAX_ANSWERS = 10_000;

/** Everything needed to play a game again exactly. Plain JSON, so a failure report can print it. */
export type GameRecord = { setup: Setup; seed: Seed; answers: Answer[] };
/** Picks the next answer for `state`, or null to stop early. */
export type Chooser = (state: GameState) => Answer | null;
export type Played = { record: GameRecord; final: GameState };
type Step = { state: GameState; events: GameEvent[] };

/** How many games to play, from the FUZZ_GAMES environment variable. */
export function gameCount(raw: string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_GAMES;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new Error(`FUZZ_GAMES must be a whole number of games, not "${raw}"`);
  return n;
}

/**
 * Fuzz game `game`, played from its own seed. Every third game has the Easy AI on one side (LIO when
 * game % 6 is 0, SAE when it is 3) and the random chooser on the other; the rest are random on both.
 */
export function playFuzzGame(game: number, rules: Ruleset = ruleset, again = "playFuzzGame"): Played {
  const rng = seededRng(game);
  const { setup, seed } = randomGame(rng, game);
  const easy: Side | null = game % 6 === 0 ? "lio" : game % 6 === 3 ? "sae" : null;
  const choose = easy === null ? randomChooser(rules, rng) : easyChooser(rules, easy, rng);
  return playGame(rules, `Fuzz game ${game} (${again}(${game}) plays it again)`, setup, seed, choose);
}

/** A recorded game, answer by answer, with every check. It may stop before the game ends. */
export function playRecorded(name: string, record: GameRecord): Played {
  let next = 0;
  return playGame(ruleset, `Fixed game "${name}"`, record.setup, record.seed, () => record.answers[next++] ?? null);
}

/**
 * 1-4 turns of 1-2 plays each, and random starting hands and draw pile from cards c1 to c85. Each hand
 * gets the non-neutral cards the game needs, turns x (1 + playsPerTurn), of either side's, plus 0-8 more
 * of any affiliation, in random order; the draw pile gets 0-30. A game of two or more turns gets up to one
 * era for each later turn, of 1-5 cards each, on random turns (#37). Each turn opens with a secret pair
 * (#35); the random chooser then plays cards for their events or points, rival cards included (#36).
 * Each side gets its own random Contingency deck (#64). The hand size is 1 + playsPerTurn plus 0-4, but never more
 * than half the first era's cards (createGame's check), so the turn-start refill draws cards and can run the draw
 * pile out. The cards a hand needs are all dealt, so a hand always holds a card that can open the turn.
 */
export function randomGame(rng: Rng, game: number): { setup: Setup; seed: Seed } {
  const turns = 1 + rng.int(MAX_TURNS);
  const playsPerTurn = 1 + rng.int(MAX_PLAYS);
  const needed = turns * (1 + playsPerTurn);
  const cards = shuffled(rng, FUZZ_CARDS);
  const sided = cards.filter((card) => !neutral.has(card));
  const others = cards.filter((card) => !sided.slice(0, 2 * needed).includes(card));
  const lioExtra = rng.int(MAX_EXTRA + 1);
  const saeExtra = rng.int(MAX_EXTRA + 1);
  const pileStart = lioExtra + saeExtra;
  const pileEnd = pileStart + rng.int(MAX_PILE + 1);
  const eras = randomEras(rng, turns, others.slice(pileEnd));
  const lio = shuffled(rng, [...sided.slice(0, needed), ...others.slice(0, lioExtra)]);
  const sae = shuffled(rng, [...sided.slice(needed, 2 * needed), ...others.slice(lioExtra, pileStart)]);
  const deck = others.slice(pileStart, pileEnd);
  const contingency = { lio: randomDeck(rng), sae: randomDeck(rng) };
  // Drawn last, so it leaves every other part of a game's setup as it was before hands refilled.
  const firstEra = Math.floor((lio.length + sae.length + deck.length) / 2);
  const handSize = Math.min(1 + playsPerTurn + rng.int(MAX_HAND_EXTRA + 1), firstEra);
  // The World deck (#131) is drawn after everything else, so the rest of each game's setup stays as it was.
  const world = randomDeck(rng);
  return {
    setup: {
      seedHash: seedHash(`fuzz-${game}`),
      hands: { lio, sae },
      deck,
      turns,
      playsPerTurn,
      handSize,
      ...(eras.length > 0 ? { eras } : {}),
      // The decks are drawn after the rest, so they leave every other part of a game's setup as it was before #64.
      contingency: { ...contingency, world },
    },
    seed: `fuzz-${game}`,
  };
}

/** 0 to turns - 1 eras, each on its own random turn from 2 to `turns`, with 1-5 cards taken in order from `pool`. */
function randomEras(rng: Rng, turns: number, pool: readonly CardId[]): EraEntry[] {
  const count = rng.int(turns);
  const laterTurns = Array.from({ length: turns - 1 }, (_, i) => i + 2);
  let next = 0;
  return shuffled(rng, laterTurns)
    .slice(0, count)
    .map((turn) => {
      const cards = pool.slice(next, next + 1 + rng.int(MAX_ERA_CARDS));
      next += cards.length;
      return { era: "fuzz", turn, cards };
    });
}

/**
 * A Contingency deck: the default 1 to 6 about one time in four, otherwise 3-8 cards numbered 1 to 12, in
 * random order, so lengths vary and repeats and two-digit numbers turn up.
 */
function randomDeck(rng: Rng): number[] {
  if (rng.int(4) === 0) return shuffled(rng, DEFAULT_DECK);
  return Array.from({ length: MIN_DECK + rng.int(MAX_DECK - MIN_DECK + 1) }, () => 1 + rng.int(MAX_NUMBER));
}

/**
 * Picks one of the sides that can answer, then one of its legal answers, each uniformly at random.
 * When both sides are waiting (a simultaneous pair), either may answer first.
 */
export function randomChooser(rules: Ruleset, rng: Rng): Chooser {
  return (state) => {
    const { decision, legal } = nextToAnswer(rules, state, rng);
    return { decisionId: decision.id, side: decision.side, value: legal[rng.int(legal.length)]! };
  };
}

type Waiting = { decision: Decision; legal: AnswerValue[] };

/** Of the sides that can answer now, one picked with `rng`, and its legal answers. */
function nextToAnswer(rules: Ruleset, state: GameState, rng: Rng): Waiting {
  const waiting: Waiting[] = [];
  for (const side of SIDES) {
    const decision = attempt(`pendingFor('${side}')`, () => pendingFor(state, side));
    const legal = attempt(`legalAnswers('${side}')`, () => legalAnswers(rules, state, side));
    if (decision !== null && legal.length > 0) waiting.push({ decision, legal });
  }
  if (waiting.length === 0) throw new Error("no side has an answer to give"); // checkStep catches this first
  return waiting[rng.int(waiting.length)]!;
}

const TWO_32 = 4294967296;
/**
 * Like randomChooser, but `side` is played by the Easy AI: it sees only its `viewFor` view and answers with
 * easyAnswer. Which waiting side answers next (so Easy is not always first in a simultaneous pair) and the
 * other side's answers are chosen as randomChooser does.
 */
export function easyChooser(rules: Ruleset, side: Side, rng: Rng): Chooser {
  const random = (): number => rng.int(TWO_32) / TWO_32;
  return (state) => {
    const { decision, legal } = nextToAnswer(rules, state, rng);
    if (decision.side !== side) {
      return { decisionId: decision.id, side: decision.side, value: legal[rng.int(legal.length)]! };
    }
    const value = easyAnswer(rules, viewFor(state, side), side, EASY_WEIGHTS, random);
    if (value === null) throw new Error("the Easy AI gave no answer for a pending decision");
    return { decisionId: decision.id, side, value };
  };
}

/**
 * Plays a game from `setup` and `seed`, answering with `choose` until the game ends. Checks invariants 1, 3,
 * 4 and 5 on the state from createGame and after every answer, then invariant 6 at the end. A game that
 * reached its end is also checked with verifyGame. Each step's announced draws from the player's deck must use
 * the deck of the side that last picked or played their card (playerDraws.ts), and each announced playedBy test
 * must take exactly one branch, the one matching that side (playedBy.ts). Each step's triggers fire only as their
 * filters and once allow, from the state before it, its events and the state after it (filterChecks.ts).
 */
export function playGame(rules: Ruleset, label: string, setup: Setup, seed: Seed, choose: Chooser): Played {
  const record: GameRecord = { setup: deepFreeze(setup), seed, answers: [] };
  const players = new Map<CardId, Side>();
  const plays = new Map<CardId, PlayRecord>();
  try {
    let { state, events } = started(rules, setup, seed);
    const allEvents = [...events];
    checkStep(rules, setup, state, events, seed, { before: null, allEvents, knowledge: null });
    while (state.public.status.kind === "active") {
      if (record.answers.length >= MAX_ANSWERS) throw new Error(`the game is still going after ${MAX_ANSWERS} answers`);
      const answer = choose(state);
      if (answer === null) break;
      record.answers.push(deepFreeze(answer));
      notePlayer(players, answer);
      notePlay(plays, rules, answer);
      const before = state.public.markers;
      const knowledge = knowledgeOf(state);
      const prior = state;
      ({ state, events } = answered(rules, state, answer));
      allEvents.push(...events);
      checkStep(rules, setup, state, events, seed, { before, allEvents, knowledge });
      checkTriggerFilters(rules, prior, events, state);
      checkPlayerDraws(events, players);
      checkPlayedBy(events, plays);
    }
    checkReplay(rules, record, state);
    // A recorded game may stop early; verifyGame only accepts a game that reached its end.
    if (state.public.status.kind === "over") checkVerify(rules, record, state, allEvents);
    return { record, final: state };
  } catch (err) {
    throw new Error(report(label, record, err), { cause: err });
  }
}

/** Invariant 6: replaying the record's answers from createGame gives a state deep-equal to `final`. */
export function checkReplay(rules: Ruleset, record: GameRecord, final: GameState): void {
  let { state } = started(rules, record.setup, record.seed);
  for (const [i, answer] of record.answers.entries()) {
    try {
      state = answered(rules, state, answer).state;
    } catch (err) {
      throw new Error(`replaying answer ${i + 1} of the log failed: ${String(err)}`, { cause: err });
    }
  }
  const diff = firstDifference(state, final, "state");
  if (diff !== null) throw new Error(`replaying the answer log gives a different final state: ${diff} differs`);
}

/** createGame, with its result deep-frozen the moment it returns. */
function started(rules: Ruleset, setup: Setup, seed: Seed): Step {
  const r = attempt("createGame", () => createGame(rules, setup, seed));
  if (!r.ok) throw new Error(`createGame refused the setup: ${r.error.code} ${r.error.message ?? ""}`);
  return deepFreeze(r.value);
}

/** apply, with its result deep-frozen the moment it returns. A legal answer must be accepted. */
function answered(rules: Ruleset, state: GameState, answer: Answer): Step {
  const r = attempt("apply", () => apply(rules, state, answer));
  if (!r.ok) throw new Error(`apply refused ${JSON.stringify(answer)}: ${r.error.code} ${r.error.message ?? ""}`);
  return deepFreeze(r.value);
}

function report(label: string, record: GameRecord, err: unknown): string {
  const at = record.answers.length === 0 ? "at the start" : `at answer ${record.answers.length}`;
  return [
    `${label} failed ${at}: ${err instanceof Error ? err.message : String(err)}`,
    `Seed: ${JSON.stringify(record.seed)}. The game's record (setup, seed and every answer so far):`,
    JSON.stringify(record),
    "Once it is fixed, add that record to tests/fuzz/fixedGames.ts so it is checked on every run.",
  ].join("\n");
}

/** Fisher-Yates shuffle of a copy of `items`. */
function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
