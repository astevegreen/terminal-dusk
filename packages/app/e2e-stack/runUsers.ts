// The run's two players, found and removed by email with the service role (A10). The browsers create the users by
// pressing "Send code", so the test never holds their ids or tokens until it looks them up here. Only these checks
// use the service role; no browser ever does.
import { cleanUp, grantWeb } from "../src/transport/test/localStack.ts";
import type { StackKeys, StackUser } from "../src/transport/test/localStack.ts";

const admin = (keys: StackKeys) => ({ apikey: keys.serviceKey, Authorization: `Bearer ${keys.serviceKey}` });

/** The id of the user with this email, or null when there is none (yet). */
export async function userIdByEmail(keys: StackKeys, email: string): Promise<string | null> {
  for (let page = 1; page <= 50; page++) {
    const reply = await fetch(`${keys.url}/auth/v1/admin/users?page=${page}&per_page=200`, { headers: admin(keys) });
    if (reply.status !== 200) return null;
    const { users } = (await reply.json()) as { users?: { id: string; email?: string }[] };
    if (!users || users.length === 0) return null;
    const found = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (users.length < 200) return null;
  }
  return null;
}

/** Gives the user with this email the full game on the web, so they may create a game. */
export async function grantWebByEmail(keys: StackKeys, email: string): Promise<void> {
  const id = await userIdByEmail(keys, email);
  if (id === null) throw new Error("the creator's account was not found by its email");
  await grantWeb(keys, { id, token: "" });
}

/** The matches these users play in, and the invites they made, found with the service role. */
async function matchesOf(keys: StackKeys, ids: string[]): Promise<string[]> {
  const perUser = await Promise.all(
    ids.map(async (id): Promise<string[]> => {
      await fetch(`${keys.url}/rest/v1/match_invite?host_id=eq.${id}`, { method: "DELETE", headers: admin(keys) });
      const reply = await fetch(
        `${keys.url}/rest/v1/match?select=match_id&or=(lio_player.eq.${id},sae_player.eq.${id})`,
        { headers: admin(keys) },
      );
      return reply.status === 200 ? ((await reply.json()) as { match_id: string }[]).map((m) => m.match_id) : [];
    }),
  );
  return perUser.flat();
}

/**
 * Removes whatever the run made, whatever stage it reached: each user that exists (they do from "Send code" on),
 * their entitlement rows, their invites, and any match they play in.
 */
export async function removeRun(keys: StackKeys, emails: string[]): Promise<void> {
  const found = await Promise.all(emails.map((email) => userIdByEmail(keys, email)));
  const ids = found.filter((id): id is string => id !== null);
  const matchIds = await matchesOf(keys, ids);
  const users: StackUser[] = ids.map((id) => ({ id, token: "" }));
  await cleanUp(keys, [...new Set(matchIds)], users);
}
