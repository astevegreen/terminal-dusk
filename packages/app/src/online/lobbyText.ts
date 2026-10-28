// The lobby's words: one plain message per refusal code, and how a game's side and result read on screen.
import type { GameStatus, Side } from "@terminal-dusk/engine";
import type { LobbyRefusal } from "./lobbyHttp.ts";

export const LOBBY_REFUSAL: Record<LobbyRefusal, string> = {
  notSignedIn: "You are signed out. Sign in again, then try again.",
  notEntitled:
    "Free players can join a game they are invited to but cannot create one. You can still join a game by its code.",
  inviteNotFound: "No open game has that code. Check it with your friend and try again.",
  ownInvite: "That is your own invite. Send the code to your friend to join.",
  sideRequired: "Pick LIO or SAE to join this game.",
  sideNotChoosable: "This invite already fixes the sides. Join it without picking one.",
  illegalSide: "That side cannot be picked. Pick LIO or SAE.",
  invalidInvite: "Those game settings were not accepted. Check them and try again.",
  tooManyRequests: "Too many tries. Wait a minute, then try again.",
  network: "Cannot reach the server. Check your connection and try again.",
};

export { SIDE_NAME } from "../displayText.ts";

/** "Your game is on", or "Game over" with a win, loss or draw for `mySide`. */
export function gameLine(status: GameStatus, mySide: Side): string {
  if (status.kind === "active") return "Your game is on";
  if (status.winner === null) return "Game over: a draw";
  return status.winner === mySide ? "Game over: you won" : "Game over: you lost";
}
