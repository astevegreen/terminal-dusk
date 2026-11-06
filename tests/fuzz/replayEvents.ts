// Every event of a played game, from replaying its record answer by answer: the suites that count what random games
// reach (markers, neutral, extraSteps) read the events this way.
import { apply, createGame } from "@terminal-dusk/engine";
import type { GameEvent, Ruleset } from "@terminal-dusk/engine";
import type { GameRecord } from "./play.ts";

/** Every event of a played game, replayed answer by answer. */
export function eventsOf(rules: Ruleset, record: GameRecord): GameEvent[] {
  const created = createGame(rules, record.setup, record.seed);
  if (!created.ok) throw new Error(`createGame failed: ${created.error.code}`);
  let state = created.value.state;
  const events = [...created.value.events];
  for (const answer of record.answers) {
    const r = apply(rules, state, answer);
    if (!r.ok) throw new Error(`apply failed: ${r.error.code}`);
    state = r.value.state;
    events.push(...r.value.events);
  }
  return events;
}
