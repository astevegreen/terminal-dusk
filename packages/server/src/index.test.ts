import { describe, expect, it } from "vitest";
import * as entry from "./index.ts";

describe("@terminal-dusk/server entry point", () => {
  it("exports the submit handler, the in-memory and Supabase stores, the read model and the invite functions, and nothing else at run time", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "CODE_TRIES",
      "INVITE_CODE_ALPHABET",
      "INVITE_CODE_LENGTH",
      "MemoryInviteStore",
      "MemoryStore",
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
    ]);
  });
});
