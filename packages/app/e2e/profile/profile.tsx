// The test page behind profileView.e2e.ts (#680): the real ProfileView with a made-up rating row, so it can be
// measured in a browser at phone and desktop sizes. `?state=` picks `rated` (the default), `unrated`, `loading` or
// `failed`; a very long name checks that nothing scrolls sideways.
import { createRoot } from "react-dom/client";
import type { PlayerRating } from "../../src/online/playerRating.ts";
import { ProfileView } from "../../src/online/ProfileView.tsx";

const ROW: PlayerRating = {
  rating: 1512.4,
  rankedGames: 4,
  lio: { wins: 4, losses: 2, draws: 1 },
  sae: { wins: 3, losses: 1, draws: 1 },
  updatedAt: 5,
};
const LONG_NAME = "A".repeat(120);

const state = new URLSearchParams(window.location.search).get("state") ?? "rated";
const STATES: Record<string, PlayerRating | null | "loading" | "failed"> = {
  rated: ROW,
  unrated: null,
  loading: "loading",
  failed: "failed",
};
const rating = state in STATES ? STATES[state]! : ROW;

createRoot(document.getElementById("root")!).render(
  <ProfileView
    name={LONG_NAME}
    rating={rating as PlayerRating | null | "loading" | "failed"}
    onBack={() => undefined}
  />,
);
