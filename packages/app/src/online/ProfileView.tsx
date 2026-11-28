// A player's profile, drawn from a rating row (or none): the rating, "Unrated" before a first ranked game,
// "Provisional" for the first 10, and the record as LIO and as SAE. Words are placeholders until the owner writes
// them. It uses no hooks, so tests can render it without a browser. Rows only, no game state (hard rule 2).
import { SIDE_NAME } from "./lobbyText.ts";
import type { PlayerRating } from "./playerRating.ts";
import { RATING_WORDS, isProvisional, ratingText, recordText } from "./ratingText.ts";

const TAP = { minHeight: 44, minWidth: 44 } as const;
const PAGE = { maxWidth: "100%", overflowWrap: "anywhere" } as const;

export type ProfileViewProps = {
  /** Whose profile, as the name to show. */
  name: string;
  /** The row, null for an unrated player, or "failed" when it could not be read, or "loading". */
  rating: PlayerRating | null | "loading" | "failed";
  onBack: () => void;
};

export function ProfileView({ name, rating, onBack }: Readonly<ProfileViewProps>) {
  const row = typeof rating === "string" ? null : rating;
  return (
    <main style={PAGE}>
      <button type="button" style={TAP} onClick={onBack}>
        Back
      </button>
      <h1>{name}</h1>
      {rating === "loading" && <p role="status">Loading</p>}
      {rating === "failed" && <p role="alert">{RATING_WORDS.loadFailed}</p>}
      {rating !== "loading" && rating !== "failed" && (
        <>
          <p data-testid="rating">Rating: {ratingText(row)}</p>
          {isProvisional(row) && <p data-testid="provisional">{RATING_WORDS.provisional}</p>}
          <p data-testid="record-lio">
            As {SIDE_NAME.lio}: {recordText(row?.lio ?? { wins: 0, losses: 0, draws: 0 })}
          </p>
          <p data-testid="record-sae">
            As {SIDE_NAME.sae}: {recordText(row?.sae ?? { wins: 0, losses: 0, draws: 0 })}
          </p>
        </>
      )}
    </main>
  );
}
