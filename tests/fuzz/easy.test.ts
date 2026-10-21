// The Easy AI inside the fuzz suite (#91): every third game has it on one side, with every invariant checked.
import { apply, createGame, SIDES } from "@terminal-dusk/engine";
import type { Answer, Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { easyChooser, playFuzzGame, playGame, randomGame, ruleset } from "./play.ts";
import type { GameRecord, Played } from "./play.ts";
import { branchTaken } from "./playedBy.ts";
import { seededRng } from "./random.ts";

type Final = Played["final"];

const gamesBySide = new Map<Side, Played[]>();
/** Fuzz games 1-20 with Easy as `easy`, each played with every check; played once per side. */
function easyGames(easy: Side): Played[] {
  const known = gamesBySide.get(easy);
  if (known !== undefined) return known;
  const games = Array.from({ length: 20 }, (_, i) => {
    const rng = seededRng(i + 1);
    const { setup, seed } = randomGame(rng, i + 1);
    return playGame(ruleset, `Easy as ${easy}, game ${i + 1}`, setup, seed, easyChooser(ruleset, easy, rng));
  });
  gamesBySide.set(easy, games);
  return games;
}

/** The last states of fuzz games 1-20 with Easy as `easy`. */
const easyFinals = (easy: Side): Final[] => easyGames(easy).map((game) => game.final);

/** How many playedBy branch markers of R5b's cards a game records, by branch: its answers replayed with apply. */
function playedByBranches(record: GameRecord): { then: number; else: number } {
  const created = createGame(ruleset, record.setup, record.seed);
  if (!created.ok) throw new Error(`createGame failed: ${created.error.code}`);
  let state = created.value.state;
  const counts = { then: 0, else: 0 };
  for (const answer of record.answers) {
    const r = apply(ruleset, state, answer);
    if (!r.ok) throw new Error(`apply failed: ${r.error.code}`);
    state = r.value.state;
    for (const event of r.value.events) {
      const branch = branchTaken(event);
      if (branch !== null) counts[branch.branch]++;
    }
  }
  return counts;
}

describe("Easy in the fuzz games", () => {
  it("plays games 0, 6, 12 as LIO and 3, 9, 15 as SAE, and every one of them ends", () => {
    for (const game of [0, 3, 6, 9, 12, 15]) {
      expect(playFuzzGame(game).final.public.status.kind).toBe("over");
    }
  });

  it("answers its own side's decisions with the AI on either side, and the game still passes every check", () => {
    for (const easy of SIDES) {
      const finals = easyFinals(easy);
      expect(finals).toHaveLength(20);
      for (const final of finals) expect(final.public.status.kind).toBe("over");
    }
  });

  it("reaches the lasting markers of R4b's cards: as each side, at least one Easy game ends with markers set", () => {
    for (const easy of SIDES) {
      const marked = easyFinals(easy).filter((f) => f.public.status.kind === "over" && f.public.markers.length > 0);
      expect(marked.length, `Easy as ${easy}`).toBeGreaterThan(0);
    }
  });

  it("reaches the playedBy tests of R5b's cards: as each side, Easy games record both branches and pass every check", () => {
    for (const easy of SIDES) {
      // playGame runs every check, R5b's check that each playedBy test took the right branch included.
      const totals = { then: 0, else: 0 };
      for (const game of easyGames(easy)) {
        const counts = playedByBranches(game.record);
        totals.then += counts.then;
        totals.else += counts.else;
      }
      expect({ easy, then: totals.then > 0, else: totals.else > 0 }).toEqual({ easy, then: true, else: true });
    }
  });

  it("does not always answer first in the simultaneous opening pick", () => {
    const firstSides = new Set<Side>();
    for (let game = 1; game <= 30; game++) {
      const rng = seededRng(game);
      const { setup, seed } = randomGame(rng, game);
      const answers: Answer[] = playGame(
        ruleset,
        `Easy as lio, game ${game}`,
        setup,
        seed,
        easyChooser(ruleset, "lio", rng),
      ).record.answers;
      firstSides.add(answers[0]!.side);
    }
    expect(firstSides.size).toBe(2);
  });
});
