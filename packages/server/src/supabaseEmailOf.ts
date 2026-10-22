// A player's email address for the turn alert sweep (sweepTurnAlerts.ts, `emailOf`), read through Supabase
// Auth's admin API. It runs only with a client made with the service role key. It logs nothing, and no error
// it throws carries the address, the player id or Auth's own message.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerId } from "@terminal-dusk/host";

/** A failed address lookup. Its message names only Auth's error code (or that Auth did not answer). */
export class EmailLookupError extends Error {
  constructor(reason: string) {
    super(`Email lookup failed: ${reason}.`);
    this.name = "EmailLookupError";
  }
}

/** Supabase Auth user ids are UUIDs; any other player id belongs to no user. */
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `emailOf` for the sweep: the player's address, or `null` when the user has none or is not found.
 * Any other failure rejects with an `EmailLookupError`, so the sweep leaves the alert due for its next run.
 */
export function supabaseEmailOf(db: SupabaseClient): (player: PlayerId) => Promise<string | null> {
  return async (player) => {
    if (!USER_ID.test(player)) return null;
    let answer;
    try {
      answer = await db.auth.admin.getUserById(player);
    } catch {
      throw new EmailLookupError("Auth did not answer");
    }
    const { data, error } = answer;
    if (error) {
      if (error.status === 404 || error.code === "user_not_found") return null;
      throw new EmailLookupError(error.code ? `Auth error ${error.code}` : `Auth error status ${error.status}`);
    }
    const email = data.user?.email;
    return email === undefined || email === "" ? null : email;
  };
}
