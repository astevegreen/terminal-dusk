import { describe, expect, it } from "vitest";
import * as entry from "./index.ts";

describe("@terminal-dusk/server entry point", () => {
  it("exports the submit handler, the in-memory and Supabase match and invite stores, the read model, the invite functions, the deadline sweep, the mail port and the turn alerts, and nothing else at run time", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "CODE_TRIES",
      "INVITE_CODE_ALPHABET",
      "INVITE_CODE_LENGTH",
      "MemoryInviteStore",
      "MemoryMailer",
      "MemoryNotifyStore",
      "MemoryStore",
      "RESEND_SEND_URL",
      "SupabaseInviteStore",
      "SupabaseStore",
      "TURN_ALERT_DELAY_MS",
      "VIEWERS",
      "alertsFrom",
      "canRead",
      "createInvite",
      "inviteCode",
      "joinInvite",
      "previewInvite",
      "readMatch",
      "resendMailer",
      "rowsFor",
      "sideModeOf",
      "signInCodeEmail",
      "submit",
      "sweepDeadlines",
      "sweepTurnAlerts",
      "turnAlertEmail",
    ]);
  });
});
