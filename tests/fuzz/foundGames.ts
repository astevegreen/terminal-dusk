// The fuzz games found failing, recorded once fixed (fixedGames.ts replays them with every check). Each record is
// the game as playFuzzGame played it then, kept as data (foundGames.json) so a later change to randomGame cannot lose
// the case. What each one found:
// - fuzz game 16: a card played in the open was shuffled back into the draw pile in the same step, and the leak
//   check called naming it a leak (refill.test.ts, checkNoLeaks). Recorded from playFuzzGame(16).
// - fuzz game 955: the same bug as fuzz game 16, in a longer game. Recorded from playFuzzGame(955).
// - fuzz game 6944: with LIO dealt 12 cards, SAE's hand could not refill (R8a, handSizeFor in removed.ts). Recorded
//   from playFuzzGame(6944).
// - extra-steps game 427: LIO's opening card made LIO discard its last card, and the game then waited on a play LIO
//   had no card for; LIO now passes it (docs/design/core-loop.md, "No card left"; owner, 7 Nov 2026). Played with
//   firstExtraStepsRuleset; recorded from playExtraGame(427) in extraSteps.test.ts, when it played that ruleset.
import type { FixedGame } from "./fixedGames.ts";
import found from "./foundGames.json" with { type: "json" };

export const FOUND_GAMES: FixedGame[] = found as FixedGame[];
