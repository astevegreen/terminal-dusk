// The online lobby drawn from a lobby snapshot (online/lobbySession.ts): New game, Join a game and My games,
// plus Sign out and Back. It uses no hooks, so tests can walk and press it without a browser. The code field
// is uncontrolled; typing in it only tells the session the code changed.
import type { FormEvent, ReactNode } from "react";
import type { DeadlineRule, MatchDeadline } from "@terminal-dusk/host";
import type { SideMode } from "./lobby.ts";
import type { LobbyRefusal } from "./lobbyHttp.ts";
import type { LobbySession, LobbySnapshot } from "./lobbySession.ts";
import { LOBBY_REFUSAL, SIDE_NAME, gameLine } from "./lobbyText.ts";

const TAP = { minHeight: 44, minWidth: 44 } as const;
const PART = { flex: "1 1 240px", minWidth: 0 } as const;

export type LobbyActions = Omit<LobbySession, "getSnapshot" | "subscribe" | "start">;

export const JOIN_HINT = 'Send this code to your friend. They enter it under "Join a game".';

const SIDE_CHOICES: [string, SideMode][] = [
  ["Random sides", { mode: "random" }],
  ["I play LIO", { mode: "host", hostSide: "lio" }],
  ["I play SAE", { mode: "host", hostSide: "sae" }],
  ["My friend picks", { mode: "invitee" }],
];
const DAY_CHOICES: [string, MatchDeadline["days"]][] = [
  ["1 day", 1],
  ["3 days", 3],
  ["7 days", 7],
];
const RULE_CHOICES: [string, DeadlineRule][] = [
  ["Loss on time", "lossOnTime"],
  ["One extra deadline, then loss on time", "graceThenLoss"],
];

const sameSides = (a: SideMode, b: SideMode): boolean =>
  a.mode === b.mode && (a.mode !== "host" || b.mode !== "host" || a.hostSide === b.hostSide);

function Refusal({ refusal }: Readonly<{ refusal: LobbyRefusal | null }>) {
  return refusal === null ? null : <p role="alert">{LOBBY_REFUSAL[refusal]}</p>;
}

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
    <fieldset>
      <legend>{legend}</legend>
      {children}
    </fieldset>
  );
}

function NewGame({ snapshot, actions }: Readonly<{ snapshot: LobbySnapshot; actions: LobbyActions }>) {
  const { sides, deadline, create } = snapshot;
  const off = create.busy;
  return (
    <section style={PART} aria-labelledby="lobby-new">
      <h2 id="lobby-new">New game</h2>
      <Group legend="Sides">
        {SIDE_CHOICES.map(([text, mode]) => (
          <Choice
            key={text}
            text={text}
            on={sameSides(sides, mode)}
            disabled={off}
            pick={() => actions.chooseSides(mode)}
          />
        ))}
      </Group>
      <Group legend="Time for each move">
        {DAY_CHOICES.map(([text, days]) => (
          <Choice
            key={text}
            text={text}
            on={deadline.days === days}
            disabled={off}
            pick={() => actions.chooseDays(days)}
          />
        ))}
      </Group>
      <Group legend="When a deadline passes">
        {RULE_CHOICES.map(([text, rule]) => (
          <Choice
            key={text}
            text={text}
            on={deadline.rule === rule}
            disabled={off}
            pick={() => actions.chooseRule(rule)}
          />
        ))}
      </Group>
      <button type="button" style={TAP} disabled={off} onClick={() => void actions.create()}>
        Create game
      </button>
      {create.code !== null && (
        <div>
          <p style={{ fontSize: "2em", fontWeight: "bold" }}>{create.code}</p>
          <button type="button" style={TAP} onClick={() => void actions.copyCode()}>
            Copy
          </button>
          <p>{JOIN_HINT}</p>
        </div>
      )}
      <Refusal refusal={create.refusal} />
    </section>
  );
}

function fieldValue(form: HTMLFormElement, name: string): string {
  const field = form.elements.namedItem(name);
  return field !== null && "value" in field && typeof field.value === "string" ? field.value : "";
}

function JoinGame({ snapshot, actions }: Readonly<{ snapshot: LobbySnapshot; actions: LobbyActions }>) {
  const { join } = snapshot;
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void actions.join(fieldValue(event.currentTarget, "code"));
  };
  return (
    <section style={PART} aria-labelledby="lobby-join">
      <h2 id="lobby-join">Join a game</h2>
      <form onSubmit={submit}>
        <label>
          Invite code{" "}
          <input
            type="text"
            name="code"
            autoComplete="off"
            autoCapitalize="characters"
            style={TAP}
            disabled={join.busy}
            onChange={() => actions.codeChanged()}
          />
        </label>
        <button type="submit" style={TAP} disabled={join.busy}>
          Join
        </button>
      </form>
      {join.askSide !== null && (
        <div>
          <p>This invite lets you pick your side. LIO or SAE?</p>
          <button type="button" style={TAP} disabled={join.busy} onClick={() => void actions.pickSide("lio")}>
            Play LIO
          </button>
          <button type="button" style={TAP} disabled={join.busy} onClick={() => void actions.pickSide("sae")}>
            Play SAE
          </button>
        </div>
      )}
      {join.joined !== null && <p role="status">{`You joined. You play ${SIDE_NAME[join.joined.side]}.`}</p>}
      <Refusal refusal={join.refusal} />
    </section>
  );
}

function GameList({ games, onOpen }: Readonly<{ games: LobbySnapshot["games"]; onOpen: (matchId: string) => void }>) {
  if (games.refusal !== null) return <Refusal refusal={games.refusal} />;
  if (games.list === null) return <p>Loading your games…</p>;
  if (games.list.length === 0) return <p>No games yet</p>;
  return (
    <ul>
      {games.list.map((g) => (
        <li key={g.matchId}>
          <span>{`You play ${SIDE_NAME[g.mySide]}. ${gameLine(g.status, g.mySide)}`}</span>{" "}
          <button type="button" style={TAP} onClick={() => onOpen(g.matchId)}>
            Open
          </button>
        </li>
      ))}
    </ul>
  );
}

function MyGames({
  snapshot,
  actions,
  onOpen,
}: Readonly<{ snapshot: LobbySnapshot; actions: LobbyActions; onOpen: (matchId: string) => void }>) {
  return (
    <section style={PART} aria-labelledby="lobby-games">
      <h2 id="lobby-games">My games</h2>
      <GameList games={snapshot.games} onOpen={onOpen} />
      <button type="button" style={TAP} disabled={snapshot.games.busy} onClick={() => void actions.refresh()}>
        Refresh
      </button>
    </section>
  );
}

export type LobbyViewProps = {
  snapshot: LobbySnapshot;
  actions: LobbyActions;
  onSignOut: () => void;
  onBack: () => void;
  /** Opens the game with this match id. */
  onOpen: (matchId: string) => void;
};

/** The signed-in online screen for one lobby snapshot. */
export function LobbyView({ snapshot, actions, onSignOut, onBack, onOpen }: Readonly<LobbyViewProps>) {
  return (
    <main style={{ maxWidth: "100%", boxSizing: "border-box" }}>
      <h1>Play online</h1>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <NewGame snapshot={snapshot} actions={actions} />
        <JoinGame snapshot={snapshot} actions={actions} />
        <MyGames snapshot={snapshot} actions={actions} onOpen={onOpen} />
      </div>
      <button type="button" style={TAP} onClick={onSignOut}>
        Sign out
      </button>
      <button type="button" style={TAP} onClick={onBack}>
        Back
      </button>
    </main>
  );
}
