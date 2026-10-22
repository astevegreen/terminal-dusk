// The two emails online play sends (docs/sprint.md, O8): the sign-in code and the turn alert. Sign-in uses a
// 6-digit code, not a magic link (Decision 5), so the sign-in email has no link at all. The turn alert takes
// no match state, so it cannot name a card, a hand or anything secret.
import type { Email } from "./mailer.ts";

/** The sign-in email for `code`. Throws for a code that is not exactly 6 digits (0 to 9). */
export function signInCodeEmail(to: string, code: string): Email {
  if (!/^[0-9]{6}$/.test(code)) throw new Error("A sign-in code must be exactly 6 digits.");
  return {
    to,
    subject: `Your Terminal Dusk sign-in code: ${code}`,
    text: [
      `Your Terminal Dusk sign-in code is ${code}.`,
      "",
      "Type it into the app to sign in.",
      "",
      "Someone asked for this code to sign in with this email address. If it was not you, you can ignore this email.",
    ].join("\n"),
  };
}

/** The email telling a player a move is waiting for them, with the address of the app. */
export function turnAlertEmail(to: string, appUrl: string): Email {
  return {
    to,
    subject: "Your move is waiting in Terminal Dusk",
    text: ["A move is waiting for you in Terminal Dusk.", "", `Open the game to play it: ${appUrl}`].join("\n"),
  };
}
