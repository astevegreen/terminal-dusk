// Test helpers for invites: an in-memory invite store over O1's MemoryStore, with repeatable codes, match
// ids, seeds and random sides, and submit deps that run the first deck.
import type { Side } from "@terminal-dusk/engine";
import { firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import type { InviteDeps } from "../invite.ts";
import { MemoryInviteStore } from "../inviteStore.ts";
import { MemoryStore } from "../store.ts";
import type { SubmitDeps } from "../submit.ts";

export const HOST = "host-hana";
export const JOINER = "joiner-jo";
export const INVITE_NOW = 1_700_000_000_000;

/** Gives each value of `values` in turn, then keeps giving the last one. */
export const sequence = <T>(values: T[]) => {
  let next = 0;
  return (): T => values[Math.min(next++, values.length - 1)]!;
};

export type InviteWorld = {
  matches: MemoryStore;
  invites: MemoryInviteStore;
  deps: InviteDeps;
  submitDeps: SubmitDeps;
};

/** A fresh world. Codes are CODE0001, CODE0002...; match ids match-1, match-2...; seeds seed-1, seed-2... */
export function inviteWorld(randomHostSide: Side = "lio"): InviteWorld {
  const matches = new MemoryStore();
  const invites = new MemoryInviteStore(matches);
  const counter = (prefix: string, width = 0) => {
    let n = 0;
    return () => `${prefix}${String(++n).padStart(width, "0")}`;
  };
  const deps: InviteDeps = {
    invites,
    code: counter("CODE", 4),
    matchId: counter("match-"),
    seed: counter("seed-"),
    randomHostSide: sequence([randomHostSide]),
  };
  const submitDeps: SubmitDeps = {
    store: matches,
    ruleset: (id) => (id === firstDeckRuleset.id ? firstDeckRuleset : undefined),
  };
  return { matches, invites, deps, submitDeps };
}
