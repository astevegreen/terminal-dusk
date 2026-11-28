// unmatched-receipts.mjs lists web receipts nobody could be matched to and grants one to a named player. None of these
// tests reaches a database: the fetch is a fake that keeps what it was sent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { main, parseArgs } from "./unmatched-receipts.mjs";
import { ENV, KEY, URL, runMain } from "./lib/run-main.mjs";

const PLAYER = "123e4567-e89b-42d3-a456-426614174000";
const GRANT = ["grant", "--receipt", "txn_01", "--player", PLAYER];

/** A fake PostgREST: keeps each request and answers with `status` and a JSON `body`. */
function fakeStore(status = 200, body = "granted") {
  const requests = [];
  const fetch = async (url, init) => {
    requests.push({ url, init });
    return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
  };
  return { fetch, requests };
}

function run(argv, options = {}) {
  return runMain(main, argv, { store: fakeStore(), ...options });
}

test("list prints each receipt with its id, time, reason and source, and never the key", async () => {
  const rows = [
    { source: "paddle", receipt_ref: "txn_01", reason: "noPlayerId", created_at: 1_700_000_000_000 },
    { source: "paddle", receipt_ref: "txn_02", reason: "unknownPlayer", created_at: 1_700_000_100_000 },
  ];
  const { exit, out, err, store } = await run(["list"], { store: fakeStore(200, rows) });
  assert.equal(exit, 0);
  assert.equal(out.length, 2);
  assert.match(out[0], /txn_01.*2023-11-14T22:13:20.000Z.*noPlayerId/);
  assert.match(out[1], /txn_02.*unknownPlayer/);
  assert.equal(store.requests[0].init.method, "GET");
  assert.match(store.requests[0].url, /\/rest\/v1\/checkout_unmatched\?select=/);
  assert.equal(store.requests[0].init.headers.apikey, KEY);
  assert.ok(![...out, ...err].join("\n").includes(KEY));
});

test("list says so when there are no unmatched receipts", async () => {
  const { exit, out } = await run(["list"], { store: fakeStore(200, []) });
  assert.equal(exit, 0);
  assert.deepEqual(out, ["No unmatched receipts."]);
});

test("grant calls the one grant function with the receipt, the player and the time, and exits 0", async () => {
  const { exit, out, store } = await run(GRANT);
  assert.equal(exit, 0);
  assert.equal(store.requests.length, 1, "one call, so one transaction");
  const { url, init } = store.requests[0];
  assert.equal(url, `${URL}/rest/v1/rpc/grant_unmatched_receipt`);
  assert.equal(init.method, "POST");
  assert.deepEqual(JSON.parse(init.body), { p_receipt_ref: "txn_01", p_player: PLAYER, p_now: 1_700_000_000_000 });
  assert.equal(init.headers.Authorization, `Bearer ${KEY}`);
  assert.match(out[0], /txn_01/);
  assert.ok(!out.join("\n").includes(KEY));
});

test("a refused grant (already granted, no such receipt, no such player) says why in plain words and exits 1", async () => {
  const cases = { already: /already been granted/, unknownReceipt: /no unmatched receipt/, unknownPlayer: /no player/ };
  for (const [answer, words] of Object.entries(cases)) {
    const { exit, out, err } = await run(GRANT, { store: fakeStore(200, answer) });
    assert.equal(exit, 1, answer);
    assert.deepEqual(out, []);
    assert.match(err[0], words);
    assert.match(err[0], /Nothing was changed/);
  }
});

test("a refunded or charged-back receipt is refused in plain words, and an unknown answer is not taken as success", async () => {
  const cases = { refunded: /refunded/, chargedBack: /charged back/, somethingNew: /does not know/ };
  for (const [answer, words] of Object.entries(cases)) {
    const { exit, out, err } = await run(GRANT, { store: fakeStore(200, answer) });
    assert.equal(exit, 1, answer);
    assert.deepEqual(out, []);
    assert.match(err[0], words);
    assert.match(err[0], /Nothing was changed/);
  }
});

test("list does not read an answer that is not a list as 'no receipts'", async () => {
  const { exit, out, err } = await run(["list"], { store: fakeStore(200, { unexpected: true }) });
  assert.equal(exit, 1);
  assert.deepEqual(out, []);
  assert.match(err[0], /does not know/);
});

test("a failed call names only the status and error code, and a silent store prints none of the thrown text", async () => {
  const failed = await run(GRANT, { store: fakeStore(500, { code: "XX000", message: `boom ${KEY}` }) });
  assert.equal(failed.exit, 1);
  assert.match(failed.err[0], /500.*XX000/);
  assert.ok(!failed.err[0].includes("boom") && !failed.err[0].includes(KEY));
  const store = {
    fetch: async () => {
      throw new Error(`connect failed ${KEY}`);
    },
  };
  const silent = await run(["list"], { store });
  assert.equal(silent.exit, 1);
  assert.ok(!silent.err.join("\n").includes(KEY));
});

test("without the URL or the service role key it stops before calling the database", async () => {
  for (const env of [{ SUPABASE_URL: URL }, { SUPABASE_SERVICE_ROLE_KEY: KEY }, {}]) {
    const store = fakeStore();
    const { exit, err } = await run(GRANT, { env, store });
    assert.equal(exit, 1);
    assert.equal(store.requests.length, 0);
    assert.match(err[0], /SUPABASE_(URL|SERVICE_ROLE_KEY)/);
    assert.ok(!err.join("\n").includes(KEY));
  }
});

test("accepts the URL and key under the names `supabase status -o env` prints, and a URL ending in slashes", async () => {
  const store = fakeStore();
  const { exit } = await run(GRANT, { env: { API_URL: `${URL}//`, SERVICE_ROLE_KEY: KEY }, store });
  assert.equal(exit, 0);
  assert.equal(store.requests[0].url, `${URL}/rest/v1/rpc/grant_unmatched_receipt`);
});

test("parseArgs takes list, and grant with a receipt and a UUID player", () => {
  assert.deepEqual(parseArgs(["list"]), { command: "list" });
  assert.deepEqual(parseArgs(GRANT), { command: "grant", receipt: "txn_01", player: PLAYER });
  assert.deepEqual(parseArgs(["grant", "--player", PLAYER.toUpperCase(), "--receipt", "txn_01"]).player, PLAYER);
});

test("parseArgs refuses a missing command, a missing receipt, a player that is not a UUID, and unknown flags", () => {
  for (const argv of [
    [],
    ["sell"],
    ["list", "--all"],
    ["grant", "--player", PLAYER],
    ["grant", "--receipt", "txn_01"],
    ["grant", "--receipt", "txn_01", "--player", "bob"],
    ["grant", "--receipt", "--player", PLAYER],
    ["grant", "--receipt", "txn_01", "--player", PLAYER, "--force"],
  ]) {
    assert.throws(() => parseArgs(argv), /usage|command|receipt|player|unknown/i, argv.join(" "));
  }
});

test("bad arguments print the usage line and exit 1, without calling the database", async () => {
  const store = fakeStore();
  const { exit, out, err } = await run(["grant", "--receipt", "txn_01", "--player", "bob"], { store });
  assert.equal(exit, 1);
  assert.deepEqual(out, []);
  assert.equal(store.requests.length, 0);
  assert.match(err.join("\n"), /UUID/);
});
