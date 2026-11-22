// Each side's special ability (docs/design/sides.md, "Asymmetry"; #602), in the Details panel: what it does, its
// number, and whether it worked (or, for Unified command, is ready) this turn. Drawn from the frame's public state
// alone; both abilities are automatic, so nothing here is tappable. A game whose setup names none shows nothing.
import { SIDES } from "@terminal-dusk/engine";
import type { AbilityState, PublicState } from "@terminal-dusk/engine";
import { SIDE_NAME } from "../displayText.ts";
import { Region } from "./regions.tsx";

const times = (n: number): string => (n === 1 ? "once" : `${n} times`);

/** "Resilient institutions: the first 1 drawn from its own Contingency deck each turn is set aside …". */
export function abilityText(ability: AbilityState): string {
  if (ability.id === "resilientInstitutions") {
    const rule =
      ability.perTurn === 1
        ? "the first 1 it draws from its own Contingency deck each turn is set aside and drawn again"
        : `up to ${ability.perTurn} times a turn, a 1 it draws from its own Contingency deck is set aside and drawn again`;
    const now = ability.used === 0 ? "Not used this turn" : `Used ${times(ability.used)} this turn`;
    return `Resilient institutions: ${rule} (not the crisis draw). ${now}.`;
  }
  const rule = `after it plays its own card for the event, its next card played for points this turn counts ${ability.bonus} more`;
  const now = ability.ready
    ? "Ready now"
    : ability.used === 0
      ? "Not used this turn"
      : `Used ${times(ability.used)} this turn`;
  return `Unified command: ${rule}. ${now}.`;
}

export function Abilities({ pub }: Readonly<{ pub: PublicState }>) {
  const abilities = pub.abilities;
  if (abilities === undefined) return null;
  return (
    <Region id="abilities" title="Special abilities">
      {SIDES.map((side) => (
        <p key={side}>{`${SIDE_NAME[side]}: ${abilityText(abilities[side])}`}</p>
      ))}
    </Region>
  );
}
