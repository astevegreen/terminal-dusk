// The score track and the Escalation track, drawn from the frame's public state alone (docs/architecture.md,
// Decision 6; A15, issue #448). Both are hidden on a map without scoring. Nothing here is tappable.
import { closedRegions } from "@terminal-dusk/host/first-deck";
import type { PublicState } from "@terminal-dusk/engine";
import { ESCALATION_NAME, regionNamer, scoreText } from "../displayText.ts";

/** Escalation's top level: the crisis. */
const ESCALATION_TOP = 6;

function ScoreTrack({ score, end }: Readonly<{ score: number; end: number }>) {
  const percent = ((score + end) / (2 * end)) * 100;
  return (
    <div className="track-score">
      <span>{`LIO wins at -${end}`}</span>
      <div
        className="track-bar"
        role="meter"
        aria-label="Score track"
        aria-valuemin={-end}
        aria-valuemax={end}
        aria-valuenow={score}
        aria-valuetext={scoreText(score)}
      >
        <span className="track-marker" style={{ left: `${percent}%` }} />
      </div>
      <span>{`SAE wins at +${end}`}</span>
      <span className="track-value">{`Score: ${scoreText(score)}`}</span>
    </div>
  );
}

/** "Escalation 3 of 6: Confrontation. Closed: Europe, East and South Asia" (or "Closed: none"). */
function escalationText(pub: PublicState, escalation: number): string {
  const name = regionNamer(pub);
  const closed = closedRegions(pub).map(name).join(", ") || "none";
  return `Escalation ${escalation} of ${ESCALATION_TOP}: ${ESCALATION_NAME[escalation] ?? ""}. Closed: ${closed}`;
}

/** The two tracks in one region under the status bar; nothing when the map has no scoring. */
export function Tracks({ pub }: Readonly<{ pub: PublicState }>) {
  const scoring = pub.map?.scoring;
  if (scoring === undefined) return null;
  return (
    <section aria-label="Score and Escalation" data-testid="tracks" className="game-tracks">
      {pub.score !== undefined && <ScoreTrack score={pub.score} end={scoring.track.end} />}
      {pub.escalation !== undefined && <p className="track-escalation">{escalationText(pub, pub.escalation)}</p>}
    </section>
  );
}
