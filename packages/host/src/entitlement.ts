// Who may create an online game (docs/architecture.md, Product calls: "Free players cannot create online
// games"). The server looks up a player's entitlements; the host only decides. Joining is not checked here.
import type { HostError } from "./types.ts";

/** The platforms a game is played on, and so the platforms an entitlement can be for. */
export const PLATFORMS = ["web", "steam", "ios", "android"] as const;
export type Platform = (typeof PLATFORMS)[number];

/** One owned copy of the full game: the platform it is for, and where it came from (a store, a gift code). */
export type Entitlement = { platform: Platform; source: string };

const KNOWN: readonly unknown[] = PLATFORMS;

/** True when `value` is one of the four platforms. */
export const isPlatform = (value: unknown): value is Platform => KNOWN.includes(value);

/** True when `value` is an entitlement: a known platform and a non-empty `source` string. */
export function isEntitlement(value: unknown): value is Entitlement {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Partial<Entitlement>;
  return isPlatform(e.platform) && typeof e.source === "string" && e.source.length > 0;
}

/**
 * Null when the player may create an online game on `platform`: one of their entitlements is for exactly
 * that platform. Otherwise a `notEntitled` refusal. The whole input is checked first, so a malformed
 * platform or entitlement list is `invalidConfig` even when a matching entitlement is also present.
 */
export function createOnlineRefusal(entitlements: Entitlement[], platform: Platform): HostError | null {
  if (!isPlatform(platform)) return { code: "invalidConfig", message: "Unknown platform." };
  if (!Array.isArray(entitlements) || !entitlements.every(isEntitlement))
    return { code: "invalidConfig", message: "The player's entitlements are not a list of valid entitlements." };
  if (entitlements.some((e) => e.platform === platform)) return null;
  return {
    code: "notEntitled",
    message:
      "Creating an online game needs the full game on this platform. You can still join a private game you are invited to.",
  };
}
