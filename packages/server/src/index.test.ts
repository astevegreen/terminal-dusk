import { describe, expect, it } from "vitest";
import * as entry from "./index.ts";

describe("@terminal-dusk/server entry point", () => {
  it("exports the submit handler, the in-memory and Supabase match and invite stores, the read model, the invite functions and the deadline sweep, and nothing else at run time", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "CODE_TRIES",
      "INVITE_CODE_ALPHABET",
      "INVITE_CODE_LENGTH",
      "MemoryInviteStore",
      "MemoryStore",
      "SupabaseInviteStore",
      "SupabaseStore",
      "VIEWERS",
      "canRead",
      "createInvite",
      "inviteCode",
      "joinInvite",
      "previewInvite",
      "readMatch",
      "rowsFor",
      "sideModeOf",
      "submit",
      "sweepDeadlines",
    ]);
  });
});
