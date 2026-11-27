// Which sound each EventKind and UI cue plays. A new kind without an entry here fails the type check (hard rule 9).
// Ids only: the files, each approved by the owner, are listed in the sound manifest, and an id with no file is silent.
import type { EventKind } from "@terminal-dusk/engine";

/** Every sound the game can ask for. Generic, so one file serves every cue that sounds alike. */
export const SOUND_IDS = [
  "uiTap",
  "cardDraw",
  "cardPlayed",
  "shuffle",
  "influence",
  "reveal",
  "notice",
  "alert",
  "scored",
  "eraStart",
  "turnStart",
  "victory",
  "defeat",
] as const;
export type SoundId = (typeof SOUND_IDS)[number];

/** Moments the app marks with a sound that no single game event stands for. */
export const UI_CUES = ["tap", "cardPlayed", "turnStart", "victory", "defeat"] as const;
export type UiCue = (typeof UI_CUES)[number];

/**
 * The sound of each event, or null for silence. Silent kinds are bookkeeping, or arrive beside another event that
 * already sounds: points spent with the influence they buy, a region's score with the score track's move.
 */
export const eventSounds: Record<EventKind, SoundId | null> = {
  cardDrawn: "cardDraw",
  cardDrawnHidden: "cardDraw",
  marker: null,
  pointsSpent: null,
  influencePlaced: "influence",
  realigned: "influence",
  intervened: "influence",
  drawPileReshuffled: "shuffle",
  eraStarted: "eraStart",
  contingencyDrawn: "reveal",
  abilityRedraw: "reveal",
  abilityReady: "notice",
  abilityBonus: "notice",
  contingencyDeckReshuffled: "shuffle",
  modifierStarted: "notice",
  modifierEnded: null,
  triggerSet: "notice",
  triggerFired: "notice",
  triggerEnded: null,
  handRevealed: "reveal",
  handRevealedHidden: "reveal",
  cardsDiscarded: "cardPlayed",
  playPassed: "notice",
  escalationChanged: "alert",
  escalationCrisis: "alert",
  regionScored: null,
  scoreChanged: "scored",
  techRaceAttempted: "reveal",
};

/** The sound of each UI cue, or null for silence. */
export const uiSounds: Record<UiCue, SoundId | null> = {
  tap: "uiTap",
  cardPlayed: "cardPlayed",
  turnStart: "turnStart",
  victory: "victory",
  defeat: "defeat",
};
