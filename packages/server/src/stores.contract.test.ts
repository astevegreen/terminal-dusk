// The store contracts (test/contracts/) run against the in-memory stores; stores.contract.stack.test.ts runs the
// same contracts against their Supabase twins, so the fakes cannot drift from the real tables unseen.
import { describe } from "vitest";
import { MemoryEntitlementStore } from "./entitlementStore.ts";
import { inviteCode } from "./inviteCode.ts";
import { MemoryInviteStore } from "./inviteStore.ts";
import { MemoryNotifyStore } from "./notifyStore.ts";
import { MemoryStore } from "./store.ts";
import { deadlineStoreContract } from "./test/contracts/deadlineStore.ts";
import { entitlementChargebacksContract } from "./test/contracts/entitlementChargebacks.ts";
import { entitlementReceiptsContract } from "./test/contracts/entitlementReceipts.ts";
import { inviteStoreContract } from "./test/contracts/inviteStore.ts";
import { matchStoreContract } from "./test/contracts/matchStore.ts";
import { notifyStoreContract } from "./test/contracts/notifyStore.ts";
import { createdWithClock } from "./test/deadlines.ts";
import { created } from "./test/match.ts";
import { writeOf } from "./test/stack.ts";

let ids = 0;
const freshMatchId = (): string => `contract-${(ids += 1)}`;

describe("MemoryStore keeps the MatchStore contract", () => {
  matchStoreContract(() => {
    const store = new MemoryStore();
    return {
      store,
      fresh: () => created(freshMatchId()),
      putIn: (write) => Promise.resolve(store.insert(write.record.matchId, write)),
      forgetRatings: () => Promise.resolve(),
    };
  });
});

describe("MemoryInviteStore keeps the InviteStore contract", () => {
  inviteStoreContract(() => {
    const matches = new MemoryStore();
    return {
      store: new MemoryInviteStore(matches),
      matches,
      host: "host-hana",
      joiner: "joiner-jo",
      third: "third-tess",
      code: () => inviteCode(),
      write: (players) => writeOf(created(freshMatchId(), players)),
    };
  });
});

describe("MemoryNotifyStore keeps the NotifyStore contract", () => {
  notifyStoreContract(() => ({
    store: new MemoryNotifyStore(),
    players: ["player-alice", "player-bob"],
    matches: (count) => Promise.resolve(Array.from({ length: count }, freshMatchId)),
  }));
});

describe("MemoryStore keeps the DeadlineStore contract", () => {
  deadlineStoreContract(() => {
    const store = new MemoryStore();
    return {
      store,
      players: ["alice", "bob"],
      clocked: (rule, at) => createdWithClock(freshMatchId(), rule, at),
      plain: () => created(freshMatchId()),
      unknownId: freshMatchId,
      putIn: (write) => Promise.resolve(store.insert(write.record.matchId, write)),
    };
  });
});

const memoryReceipts = () => {
  const store = new MemoryEntitlementStore();
  return {
    store,
    player: () => `player-${(ids += 1)}`,
    receipt: () => `receipt-${(ids += 1)}`,
    unmatched: (source: string, receiptRef: string) => Promise.resolve(store.unmatchedFor(source, receiptRef)),
  };
};

describe("MemoryEntitlementStore keeps the EntitlementReceipts contract", () => {
  entitlementReceiptsContract(memoryReceipts);
  entitlementChargebacksContract(memoryReceipts);
});
