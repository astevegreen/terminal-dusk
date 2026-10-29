// One online game drawn from an online game snapshot (online/onlineGame.ts): the turn line, the deadline line,
// Back, and the board through the same GameScreen the game against the AI uses. It uses no hooks, so tests can
// walk and press it without a browser. While the game is loading only the turn line and Back show.
import type { CardId } from "@terminal-dusk/engine";
import type { CardAffiliation, CardQuestion } from "../decisionPrompts.tsx";
import type { CardRules } from "../displayText.ts";
import { GameScreen } from "../game/GameScreen.tsx";
import { deadlineText, turnText } from "./gameText.ts";
import type { OnlineGame, OnlineGameSnapshot } from "./onlineGame.ts";

const TAP = { minHeight: 44, minWidth: 44 } as const;
const BAR = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 } as const;

/** What the view calls on the session: answer the waiting decision, and close it on Back. */
export type OnlineGameActions = Pick<OnlineGame, "answer" | "close">;

export type OnlineGameViewProps = {
  snapshot: OnlineGameSnapshot;
  /** The session, or null before it is made (the view then shows loading). */
  game: OnlineGameActions | null;
  label: (id: CardId) => string;
  question: CardQuestion;
  /** A card's rules text for the hand; left out, the hand shows names only. */
  rules?: CardRules | undefined;
  affiliation: CardAffiliation;
  /** Returns to the lobby, after the session is closed. */
  onBack: () => void;
};

export function OnlineGameView({
  snapshot,
  game,
  label,
  question,
  rules,
  affiliation,
  onBack,
}: Readonly<OnlineGameViewProps>) {
  const { frame, turn, deadline } = snapshot;
  const showing = frame !== null && turn !== "loading";
  const deadlineLine = showing && turn !== "over" && deadline !== null ? deadlineText(deadline) : null;
  const back = (): void => {
    game?.close();
    onBack();
  };
  const items = (
    <>
      <button type="button" style={TAP} onClick={back}>
        Back
      </button>
      <p role="status">{turnText(snapshot)}</p>
      {deadlineLine !== null && <p>{deadlineLine}</p>}
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
          onAnswer={turn === "mine" && game !== null ? (value) => void game.answer(value) : undefined}
          refusal={snapshot.refusal?.code ?? null}
          bar={items}
        />
      ) : (
        <div style={BAR}>{items}</div>
      )}
    </main>
  );
}
