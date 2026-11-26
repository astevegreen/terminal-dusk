// The sides' special abilities (docs/design/sides.md, "Asymmetry"; #602). Both are automatic: no decision, only an
// event when one works. The setup names each side's ability and its number; nothing here fixes either side or number.
// - Resilient institutions: up to `perTurn` times a turn, a draw from the side's own Contingency deck that shows a 1
//   is set aside, as an ordinary draw, and the side draws again (contingency.ts); that second draw stands, even a 1. Never the crisis draw (owner,
//   21 Nov 2026: "Take all"), which uses drawPlain and so neither triggers it nor uses it up. Outside card events,
//   never the World deck. In a card's event it covers only a draw made for the side that played the card, from that
//   side's own deck or the World deck standing in for it (contingency.ts, bonusSide; contingency-deck.md).
// - Unified command: after the side plays its own card for its event (turn.ts, play), the next card it plays for its
//   points in the same turn counts `bonus` more (actionMenu.ts); then it is used for the turn, and a later event
//   that turn does not set it up again. Opening cards never set it up.
// What each side has, and its use this turn, is public; it resets at turn end.
import { SIDES } from "./types.ts";
import type {
  AbilityState,
  DeckId,
  EngineError,
  GameEvent,
  GameState,
  PublicState,
  Setup,
  Side,
  SideAbility,
  Step,
} from "./types.ts";

type SpendStep = Extract<Step, { op: "spendPoints" }>;

/** The number a draw must show for Resilient institutions to set it aside: the rule's own 1, not a scenario number. */
const REDRAWN = 1;

const whole = (value: unknown): boolean => Number.isInteger(value) && (value as number) >= 1;

/** True when `value` is a known ability with exactly its one number, a whole number 1 or more. */
function isAbility(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const { id, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length !== 1) return false;
  if (id === "resilientInstitutions") return whole(rest.perTurn);
  return id === "unifiedCommand" && whole(rest.bonus);
}

/** Why the setup's abilities are unusable, or null. Left out is fine: then no side has one. */
export function abilityError(setup: Setup): EngineError | null {
  const abilities: unknown = setup.abilities;
  if (abilities === undefined) return null;
  const named = typeof abilities === "object" && abilities !== null && !Array.isArray(abilities);
  for (const side of SIDES) {
    if (!named || !isAbility((abilities as Record<string, unknown>)[side])) {
      return {
        code: "invalidSetup",
        message: `The setup's abilities must give ${side} resilientInstitutions with a perTurn, or unifiedCommand with a bonus, a whole number 1 or more.`,
      };
    }
  }
  return null;
}

const startState = (a: SideAbility): AbilityState =>
  a.id === "resilientInstitutions"
    ? { id: a.id, perTurn: a.perTurn, used: 0 }
    : { id: a.id, bonus: a.bonus, ready: false, used: 0 };

/** The public `abilities` field for a new game: present only when the setup names abilities. */
export const abilityState = (setup: Setup): { abilities?: Record<Side, AbilityState> } =>
  setup.abilities === undefined
    ? {}
    : { abilities: { lio: startState(setup.abilities.lio), sae: startState(setup.abilities.sae) } };

/**
 * True when `side`, the side whose bonuses apply to this draw from `deck` (none: no one's), has Resilient
 * institutions left this turn and the draw showed a 1: the use is counted and an abilityRedraw event says so, and
 * the caller draws again.
 */
export function takeRedraw(
  state: GameState,
  side: Side | undefined,
  deck: DeckId,
  value: number,
  events: GameEvent[],
): boolean {
  if (value !== REDRAWN || side === undefined) return false;
  const ability = state.public.abilities?.[side];
  if (ability?.id !== "resilientInstitutions" || ability.used >= ability.perTurn) return false;
  ability.used += 1;
  events.push({ kind: "abilityRedraw", visibility: "public", side, deck, setAside: value });
  return true;
}

/**
 * `side` played its own card for its event: its Unified command, if it has one, is ready, unless it is ready already
 * (no stacking) or was used this turn (#602: "then it is used for the turn").
 */
export function primeCommand(state: GameState, side: Side, events: GameEvent[]): void {
  const ability = state.public.abilities?.[side];
  if (ability?.id !== "unifiedCommand" || ability.ready || ability.used > 0) return;
  ability.ready = true;
  events.push({ kind: "abilityReady", visibility: "public", side });
}

/**
 * The points `step` gains from its side's Unified command: its bonus when the step is a card played for points
 * (`cardPoints`) and the command is ready, which it then spends; otherwise 0.
 */
export function takeCommandBonus(state: GameState, step: SpendStep, events: GameEvent[]): number {
  if (step.cardPoints !== true) return 0;
  const ability = state.public.abilities?.[step.side];
  if (ability?.id !== "unifiedCommand" || !ability.ready) return 0;
  ability.ready = false;
  ability.used += 1;
  events.push({ kind: "abilityBonus", visibility: "public", side: step.side, amount: ability.bonus });
  return ability.bonus;
}

/** At turn end, each ability is unused again and a Unified command not collected is lost. Edits `pub` in place. */
export function endTurnAbilities(pub: PublicState): void {
  if (pub.abilities === undefined) return;
  for (const side of SIDES) {
    const ability = pub.abilities[side];
    ability.used = 0;
    if (ability.id === "unifiedCommand") ability.ready = false;
  }
}

/** What `side`'s next card played for points gains now, beyond its ops (for the AI, which sees only the view). */
export function pointsBonus(pub: Pick<PublicState, "abilities">, side: Side): number {
  const ability = pub.abilities?.[side];
  return ability?.id === "unifiedCommand" && ability.ready ? ability.bonus : 0;
}
