// Plays one game for the fuzz suite, random or recorded, and checks every invariant along the way.
// A failing game throws a report with its seed and answers, ready to keep in fixedGames.ts.
import { apply, createGame, legalAnswers, pendingFor, SIDES } from "@terminal-dusk/engine";
import type {
  Answer,
  AnswerValue,
  CardDef,
  CardId,
  Decision,
  GameEvent,
  GameState,
  Ruleset,
  Seed,
  Setup,
  Step as EffectStep,
} from "@terminal-dusk/engine";
import { attempt, checkStep, firstDifference } from "./checks.ts";
import { deepFreeze } from "./deepFreeze.ts";
import { seededRng } from "./random.ts";
import type { Rng } from "./random.ts";

/** Most turns and plays per turn in a random game, and the non-neutral cards a hand then needs. */
const MAX_TURNS = 4;
const MAX_PLAYS = 2;
const MOST_NEEDED = MAX_TURNS * (1 + MAX_PLAYS);
/** Most cards of any affiliation a random hand gets beyond the ones it needs, and most in a draw pile. */
const MAX_EXTRA = 8;
const MAX_PILE = 30;
/** Every card a random setup can use, c1 to c70. Affiliations go LIO, SAE, neutral, so 47 are non-neutral. */
export const FUZZ_CARDS: readonly CardId[] = Array.from(
  { length: 2 * (MOST_NEEDED + MAX_EXTRA) + MAX_PILE },
  (_, i) => `c${i + 1}`,
);
const AFFILIATIONS: readonly CardDef["affiliation"][] = ["lio", "sae", "neutral"];
/** Every fourth card's event asks LIO or SAE yes or no, so opening events pause for a choice. */
const asks = (i: number): EffectStep[] =>
  i % 4 === 3
    ? [
        { op: "choose", who: i % 8 === 3 ? "lio" : "sae", decision: { kind: "yesNo" }, bind: "a" },
        { op: "marker", label: "asked", var: "a" },
      ]
    : [];

export const ruleset: Ruleset = deepFreeze({
  id: "fuzz-ruleset",
  cards: FUZZ_CARDS.map((id, i) => ({
    id,
    era: "fuzz",
    ops: i % 5,
    affiliation: AFFILIATIONS[i % 3]!,
    effect: asks(i),
  })),
});
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

/** Fuzz game `game`, played from its own seed. */
export function playFuzzGame(game: number): Played {
  const rng = seededRng(game);
  const { setup, seed } = randomGame(rng, game);
  return playGame(`Fuzz game ${game} (playFuzzGame(${game}) plays it again)`, setup, seed, randomChooser(rng));
}

/** A recorded game, answer by answer, with every check. It may stop before the game ends. */
export function playRecorded(name: string, record: GameRecord): Played {
  let next = 0;
  return playGame(`Fixed game "${name}"`, record.setup, record.seed, () => record.answers[next++] ?? null);
}

/**
 * 1-4 turns of 1-2 plays each, and random starting hands and draw pile from cards c1 to c70. Each hand
 * gets the non-neutral cards the game needs, turns x (1 + playsPerTurn), of either side's, plus 0-8 more
 * of any affiliation, in random order; the draw pile gets 0-30. Each turn opens with a secret pair (#35).
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
  return {
    setup: {
      seedHash: `hash-${game}`,
      hands: {
        lio: shuffled(rng, [...sided.slice(0, needed), ...others.slice(0, lioExtra)]),
        sae: shuffled(rng, [...sided.slice(needed, 2 * needed), ...others.slice(lioExtra, lioExtra + saeExtra)]),
      },
      deck: others.slice(lioExtra + saeExtra, lioExtra + saeExtra + rng.int(MAX_PILE + 1)),
      turns,
      playsPerTurn,
    },
    seed: `fuzz-${game}`,
  };
}

/**
 * Picks one of the sides that can answer, then one of its legal answers, each uniformly at random.
 * When both sides are waiting (a simultaneous pair), either may answer first.
 */
export function randomChooser(rng: Rng): Chooser {
  return (state) => {
    const waiting: { decision: Decision; legal: AnswerValue[] }[] = [];
    for (const side of SIDES) {
      const decision = attempt(`pendingFor('${side}')`, () => pendingFor(state, side));
      const legal = attempt(`legalAnswers('${side}')`, () => legalAnswers(ruleset, state, side));
      if (decision !== null && legal.length > 0) waiting.push({ decision, legal });
    }
    if (waiting.length === 0) throw new Error("no side has an answer to give"); // checkStep catches this first
    const { decision, legal } = waiting[rng.int(waiting.length)]!;
    return { decisionId: decision.id, side: decision.side, value: legal[rng.int(legal.length)]! };
  };
}

/**
 * Plays a game from `setup` and `seed`, answering with `choose` until the game ends. Checks invariants 1, 4
 * and 5 on the state from createGame and after every answer, then invariant 6 at the end.
 */
export function playGame(label: string, setup: Setup, seed: Seed, choose: Chooser): Played {
  const record: GameRecord = { setup: deepFreeze(setup), seed, answers: [] };
  try {
    let { state, events } = started(setup, seed);
    checkStep(ruleset, state, events, seed);
    while (state.public.status.kind === "active") {
      if (record.answers.length >= MAX_ANSWERS) throw new Error(`the game is still going after ${MAX_ANSWERS} answers`);
      const answer = choose(state);
      if (answer === null) break;
      record.answers.push(deepFreeze(answer));
      ({ state, events } = answered(state, answer));
      checkStep(ruleset, state, events, seed);
    }
    checkReplay(record, state);
    return { record, final: state };
  } catch (err) {
    throw new Error(report(label, record, err), { cause: err });
  }
}

/** Invariant 6: replaying the record's answers from createGame gives a state deep-equal to `final`. */
export function checkReplay(record: GameRecord, final: GameState): void {
  let { state } = started(record.setup, record.seed);
  for (const [i, answer] of record.answers.entries()) {
    try {
      state = answered(state, answer).state;
    } catch (err) {
      throw new Error(`replaying answer ${i + 1} of the log failed: ${String(err)}`, { cause: err });
    }
  }
  const diff = firstDifference(state, final, "state");
  if (diff !== null) throw new Error(`replaying the answer log gives a different final state: ${diff} differs`);
}

/** createGame, with its result deep-frozen the moment it returns. */
function started(setup: Setup, seed: Seed): Step {
  const r = attempt("createGame", () => createGame(ruleset, setup, seed));
  if (!r.ok) throw new Error(`createGame refused the setup: ${r.error.code} ${r.error.message ?? ""}`);
  return deepFreeze(r.value);
}

/** apply, with its result deep-frozen the moment it returns. A legal answer must be accepted. */
function answered(state: GameState, answer: Answer): Step {
  const r = attempt("apply", () => apply(ruleset, state, answer));
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
