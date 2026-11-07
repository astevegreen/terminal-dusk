// How many plays the sides passed in a played game for want of a card in hand (docs/design/core-loop.md, "No card
// left"; owner, 7 Nov 2026). A pass announces nothing, so this reads it from the plays counter: replaying the record
// answer by answer, the plays a turn counts beyond the plays answered are passes.
import { apply, createGame, pendingFor } from "@terminal-dusk/engine";
import type { Ruleset } from "@terminal-dusk/engine";
import type { GameRecord } from "./play.ts";

/** The plays passed in the game `record`, replayed with `rules`. */
export function passedPlaysOf(rules: Ruleset, record: GameRecord): number {
  const created = createGame(rules, record.setup, record.seed);
  if (!created.ok) throw new Error(`createGame failed: ${created.error.code}`);
  let state = created.value.state;
  let passed = 0;
  for (const answer of record.answers) {
    // A normal play counts once; Hypersonics' extra play (an extraPlay decision) is not counted (turn.ts).
    const played = "decisionId" in answer && pendingFor(state, answer.side)?.kind === "playCardAs" ? 1 : 0;
    const r = apply(rules, state, answer);
    if (!r.ok) throw new Error(`apply failed: ${r.error.code}`);
    const before = state.public;
    const after = r.value.state.public;
    // A turn ends only once all its plays are counted, and the next one opens on its opening picks, with none.
    const counted = after.turn === before.turn ? after.playsMade : 2 * before.playsPerTurn + after.playsMade;
    const passes = counted - before.playsMade - played;
    if (passes < 0) throw new Error(`the plays counter fell by ${-passes} at answer ${JSON.stringify(answer)}`);
    passed += passes;
    state = r.value.state;
  }
  return passed;
}
