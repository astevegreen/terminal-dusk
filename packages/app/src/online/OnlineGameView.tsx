// One online game drawn from an online game snapshot (online/onlineGame.ts): the turn line, the deadline line,
// Back, and the board through the same GameScreen the game against the AI uses. It uses no hooks, so tests can
// walk and press it without a browser. While the game is loading only the turn line and Back show.
import type { CardId } from "@terminal-dusk/engine";
import type { CardAffiliation, CardQuestion } from "../decisionPrompts.tsx";
import type { CardPoints, CardRules } from "../displayText.ts";
import { GameScreen } from "../game/GameScreen.tsx";
import { deadlineDetail, deadlineText, turnText } from "./gameText.ts";
import { LOBBY_REFUSAL } from "./lobbyText.ts";
import type { OnlineGame, OnlineGameSnapshot } from "./onlineGame.ts";
import { RATING_WORDS, ratingChangeText } from "./ratingText.ts";
import type { RatingChange } from "./ratingText.ts";

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
  /** A card's points for its chip in the hand strip; left out, the chips show names only. */
  points?: CardPoints | undefined;
  affiliation: CardAffiliation;
  /** The rating change of a ranked game, shown once the game is over; left out, nothing about ratings shows. */
  ratingChange?: RatingChange | undefined;
  /** Returns to the lobby, after the session is closed. */
  onBack: () => void;
};

export function OnlineGameView({
  snapshot,
  game,
  label,
  question,
  rules,
  points,
  affiliation,
  ratingChange,
  onBack,
}: Readonly<OnlineGameViewProps>) {
  const { frame, turn, deadline } = snapshot;
  const showing = frame !== null && turn !== "loading";
  const timed = showing && turn !== "over" && deadline !== null ? deadline : null;
  const deadlineLine = timed === null ? null : deadlineText(timed);
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
      {turn === "over" && ratingChange?.kind === "changed" && (
        <p data-testid="rating-change">Rating: {ratingChangeText(ratingChange)}</p>
      )}
      {turn === "over" && ratingChange?.kind === "waiting" && (
        <p data-testid="rating-change">{RATING_WORDS.notUpdated}</p>
      )}
      {snapshot.signedOut && <p role="alert">{LOBBY_REFUSAL.notSignedIn}</p>}
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
          points={points}
          affiliation={affiliation}
          onAnswer={turn === "mine" && game !== null ? (value) => void game.answer(value) : undefined}
          refusal={snapshot.refusal?.code ?? null}
          bar={items}
          // The bar's deadline line may be cut short on a phone; Details shows it in full (#504).
          extraDetails={
            timed === null ? undefined : <p data-testid="deadline-detail">{deadlineDetail(timed, frame.viewer)}</p>
          }
        />
      ) : (
        <div style={BAR}>{items}</div>
      )}
    </main>
  );
}
