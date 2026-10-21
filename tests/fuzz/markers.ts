// TEST-ONLY FIXTURES, never game content: the lasting markers (R4a) the fuzz cards set, and the `has`
// conditions that test them. Each `has` branch records a plain marker naming the label and the branch, so
// the checks (markerChecks.ts) can tell which branch a `has` took, and in which order, from the events alone.
import type { GameEvent, Step } from "@terminal-dusk/engine";

/** The few labels the fuzz cards set lasting and test, so labels repeat across cards and games. */
export const LASTING_LABELS: readonly string[] = ["flagA", "flagB"];

/** Starts every branch marker's label; then the tested label, the branch, and REACTION_BRANCH in a reaction. */
export const HAS_BRANCH = "has:";
export const REACTION_BRANCH = ":reaction";

export type Branch = "then" | "else";

/** A marker step that keeps `label` as a lasting marker. */
export const lastingMarker = (label: string): Step => ({ op: "marker", label, lasting: true });

/** The plain marker a `has` branch records: the label tested and the branch taken, and whether in a reaction. */
export const branchLabel = (label: string, branch: Branch, inReaction: boolean): string =>
  `${HAS_BRANCH}${label}:${branch}${inReaction ? REACTION_BRANCH : ""}`;

/** An `if` whose condition is `has label`; each branch records which branch it is. */
export function hasStep(label: string, inReaction: boolean): Step {
  return {
    op: "if",
    cond: { op: "has", marker: label },
    then: [{ op: "marker", label: branchLabel(label, "then", inReaction) }],
    else: [{ op: "marker", label: branchLabel(label, "else", inReaction) }],
  };
}

/** The label tested, the branch taken and whether in a reaction, for a branch marker's event; null for any other event. */
export function branchOf(event: GameEvent): { label: string; branch: Branch; inReaction: boolean } | null {
  if (event.kind !== "marker" || event.lasting === true || !event.label.startsWith(HAS_BRANCH)) return null;
  const match = /^has:(.+):(then|else)(:reaction)?$/.exec(event.label);
  if (match === null) return null;
  return { label: match[1]!, branch: match[2] as Branch, inReaction: match[3] !== undefined };
}

/** True for a lasting marker's event: one that says `lasting: true`, never guessed from its label. */
export const isLasting = (event: GameEvent): event is Extract<GameEvent, { kind: "marker" }> =>
  event.kind === "marker" && event.lasting === true;
