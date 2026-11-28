// The "Find a ranked game" screen drawn from a ranked snapshot (online/rankedSession.ts): the form (a deadline
// preset and a side), "Searching" with Cancel, the refusals in words, and the game that started. It uses no hooks, so
// tests can walk and press it without a browser. The screen scrolls only downward: every part wraps.
import type { ReactNode } from "react";
import type { Side } from "@terminal-dusk/engine";
import { SIDE_NAME } from "./lobbyText.ts";
import { LOBBY_REFUSAL } from "./lobbyText.ts";
import { RANKED_PRESETS } from "./ranked.ts";
import type { RankedSession, RankedSnapshot } from "./rankedSession.ts";
import {
  AI_LINK,
  FULL_GAME_OFFER,
  PRESET_LABEL,
  SEARCHING,
  SEARCHING_HINT,
  SIDE_CHOICE,
  STARTED_NOTIFICATION_PLACEHOLDER,
} from "./rankedText.ts";

const TAP = { minHeight: 44, minWidth: 44 } as const;

export type RankedActions = Pick<RankedSession, "choosePreset" | "chooseSide" | "search" | "cancel" | "again">;

export type RankedViewProps = {
  snapshot: RankedSnapshot;
  actions: RankedActions;
  /** Opens the game with this match id. */
  onOpen: (matchId: string) => void;
  /** Goes to the game against the AI. */
  onPlayAi: () => void;
  /** Goes to where the Full Game is offered (the online lobby's account part). */
  onFullGame: () => void;
  onBack: () => void;
};

function Choice({
  text,
  on,
  disabled,
  pick,
}: Readonly<{ text: string; on: boolean; disabled: boolean; pick: () => void }>) {
  return (
    <button type="button" style={TAP} aria-pressed={on} disabled={disabled} onClick={pick}>
      {text}
    </button>
  );
}

function Group({ legend, children }: Readonly<{ legend: string; children: ReactNode }>) {
  return (
    <fieldset style={{ minWidth: 0 }}>
      <legend>{legend}</legend>
      {children}
    </fieldset>
  );
}

function Form({
  snapshot,
  actions,
  onFullGame,
}: Readonly<Pick<RankedViewProps, "snapshot" | "actions" | "onFullGame">>) {
  const { preset, side, busy, refusal } = snapshot;
  return (
    <section aria-label="Find a ranked game">
      <Group legend="Time for each move">
        {RANKED_PRESETS.map((name) => (
          <Choice
            key={name}
            text={PRESET_LABEL[name]}
            on={preset === name}
            disabled={busy}
            pick={() => actions.choosePreset(name)}
          />
        ))}
      </Group>
      <Group legend="Your side">
        {SIDE_CHOICE.map(([text, wanted]: [string, Side | null]) => (
          <Choice key={text} text={text} on={side === wanted} disabled={busy} pick={() => actions.chooseSide(wanted)} />
        ))}
      </Group>
      <button type="button" style={TAP} disabled={busy} onClick={() => void actions.search()}>
        Search
      </button>
      {refusal === "notEntitled" ? (
        <div role="alert">
          <p>{FULL_GAME_OFFER}</p>
          <button type="button" style={TAP} onClick={onFullGame}>
            Get the Full Game
          </button>
        </div>
      ) : (
        refusal !== null && <p role="alert">{LOBBY_REFUSAL[refusal]}</p>
      )}
    </section>
  );
}

function Searching({
  snapshot,
  actions,
  onPlayAi,
}: Readonly<Pick<RankedViewProps, "snapshot" | "actions" | "onPlayAi">>) {
  return (
    <section aria-label="Searching">
      <p role="status">{SEARCHING}</p>
      <p>{SEARCHING_HINT}</p>
      <button type="button" style={TAP} disabled={snapshot.busy} onClick={() => void actions.cancel()}>
        Cancel search
      </button>
      <p>
        <button
          type="button"
          style={{ ...TAP, background: "none", border: "none", textDecoration: "underline" }}
          onClick={onPlayAi}
        >
          {AI_LINK}
        </button>
      </p>
      {snapshot.refusal !== null && <p role="alert">{LOBBY_REFUSAL[snapshot.refusal]}</p>}
    </section>
  );
}

function Started({ snapshot, actions, onOpen }: Readonly<Pick<RankedViewProps, "snapshot" | "actions" | "onOpen">>) {
  const game = snapshot.started;
  if (game === null) return null;
  return (
    <section aria-label="Game started">
      <p role="status">{`Your ranked game has started. You play ${SIDE_NAME[game.mySide]}.`}</p>
      <p>{STARTED_NOTIFICATION_PLACEHOLDER}</p>
      <button type="button" style={TAP} onClick={() => onOpen(game.matchId)}>
        Open the game
      </button>
      <button type="button" style={TAP} onClick={() => actions.again()}>
        Search again
      </button>
    </section>
  );
}

/** The ranked screen for one snapshot. */
export function RankedView(props: Readonly<RankedViewProps>) {
  const { snapshot, onBack } = props;
  return (
    <main style={{ maxWidth: "100%", boxSizing: "border-box", overflowWrap: "anywhere" }}>
      <h1>Find a ranked game</h1>
      {snapshot.phase === "form" && <Form {...props} />}
      {snapshot.phase === "searching" && <Searching {...props} />}
      {snapshot.phase === "started" && <Started {...props} />}
      <button type="button" style={TAP} onClick={onBack}>
        Back
      </button>
    </main>
  );
}
