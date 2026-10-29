// A watched game drawn from an online game snapshot: a "Watching" line, who is being waited for or how the
// game ended, Back, and the board through the same GameScreen with no way to answer. A finished game shows its
// replay when there is one. It uses no hooks, so tests can walk it without a browser.
import type { CardId } from "@terminal-dusk/engine";
import type { CardAffiliation, CardQuestion } from "../../decisionPrompts.tsx";
import { gameOverText } from "../../displayText.ts";
import type { CardRules } from "../../displayText.ts";
import { GameScreen } from "../../game/GameScreen.tsx";
import { ReplayScreen } from "../../replay/ReplayScreen.tsx";
import type { ReplayRecording } from "../../replay/recording.ts";
import { SIDE_NAME } from "../lobbyText.ts";
import type { OnlineGameSnapshot } from "../onlineGame.ts";

const TAP = { minHeight: 44, minWidth: 44 } as const;
const BAR = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 } as const;

/** The replay state of a finished game: not asked for yet, the recording, or "none" when there isn't one. */
export type WatchReplay = ReplayRecording | "none" | null;

export type WatchViewProps = {
  snapshot: OnlineGameSnapshot;
  replay: WatchReplay;
  label: (id: CardId) => string;
  question: CardQuestion;
  rules?: CardRules | undefined;
  affiliation: CardAffiliation;
  /** Leaves the watch screen, after the session is closed. */
  onBack: () => void;
};

/** The status line for a watcher: never "your move" or "you won", since a watcher plays neither side. */
export function watchText({ turn, frame }: Pick<OnlineGameSnapshot, "turn" | "frame">): string {
  if (frame === null || turn === "loading" || turn === "mine") return "Loading the game";
  const pub = frame.view.public;
  if (pub.status.kind === "over") return gameOverText(pub.status);
  const waiting = pub.pending[0]?.side;
  return waiting === undefined ? "Loading the game" : `Waiting for ${SIDE_NAME[waiting]}`;
}

export function WatchView({ snapshot, replay, label, question, rules, affiliation, onBack }: Readonly<WatchViewProps>) {
  const { frame, turn } = snapshot;
  if (turn === "over" && replay !== null && replay !== "none") {
    return (
      <ReplayScreen
        recording={replay}
        label={label}
        question={question}
        rules={rules}
        affiliation={affiliation}
        onClose={onBack}
      />
    );
  }
  const showing = frame !== null && turn !== "loading";
  const items = (
    <>
      <button type="button" style={TAP} onClick={onBack}>
        Back
      </button>
      <p>Watching</p>
      <p role="status">{watchText(snapshot)}</p>
      {turn === "over" && replay === "none" && <p>The replay is not available yet.</p>}
    </>
  );
  // In a game the lines go in the game's top bar, so the map gets the whole screen (L5, #485).
  return (
    <main className="game-page">
      {showing ? (
        <GameScreen
          frame={frame}
          log={snapshot.log}
          era={snapshot.era}
          label={label}
          question={question}
          rules={rules}
          affiliation={affiliation}
          onAnswer={undefined}
          refusal={null}
          bar={items}
        />
      ) : (
        <div style={BAR}>{items}</div>
      )}
    </main>
  );
}
