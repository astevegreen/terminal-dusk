// Each side's special ability (docs/design/sides.md, "Asymmetry"; #602), in the Details panel: its name, its number,
// and whether it worked (or, for Unified command, is ready) this turn, one line each. Drawn from the frame's public
// state alone; both abilities are automatic, so nothing here is tappable. A game whose setup names none shows nothing.
import { SIDES } from "@terminal-dusk/engine";
import type { AbilityState, PublicState } from "@terminal-dusk/engine";
import { SIDE_NAME } from "../displayText.ts";
import { Region } from "./regions.tsx";

/**
 * One short line, so both fit the Details panel at phone size with nothing to scroll (#602): "Resilient
 * institutions: redraw a 1, used 0 of 1", or "Unified command: +1 after an event, ready now". The log lines say
 * when each applies.
 */
export function abilityText(ability: AbilityState): string {
  if (ability.id === "resilientInstitutions") {
    return `Resilient institutions: redraw a 1, used ${ability.used} of ${ability.perTurn}`;
  }
  return `Unified command: +${ability.bonus} after an event, ${commandNow(ability.ready, ability.used)}`;
}

function commandNow(ready: boolean, used: number): string {
  if (ready) return "ready now";
  return used > 0 ? "used this turn" : "not used";
}

export function Abilities({ pub }: Readonly<{ pub: PublicState }>) {
  const abilities = pub.abilities;
  if (abilities === undefined) return null;
  return (
    <Region id="abilities" title="Special abilities">
      {SIDES.map((side) => (
        <p key={side}>{`${SIDE_NAME[side]} ${abilityText(abilities[side])}`}</p>
      ))}
    </Region>
  );
}
