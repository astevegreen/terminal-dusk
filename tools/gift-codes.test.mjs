// gift-codes.mjs makes a batch of gift codes: it stores their hashes and prints the plain codes once. None of these
// tests reaches a database: the fetch is a fake store that keeps what it was sent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { main, parseArgs } from "./gift-codes.mjs";

const KEY = "service-role-key-that-must-not-leak";
const URL = "http://127.0.0.1:44321";
const ENV = { SUPABASE_URL: URL, SUPABASE_SERVICE_ROLE_KEY: KEY };
const SHAPE = /^[2-9A-HJKMNP-Z]{5}(-[2-9A-HJKMNP-Z]{5}){3}$/;
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/** A fake PostgREST: keeps each request and answers with `status` (201 by default). */
function fakeStore(status = 201, body = "") {
  const requests = [];
  const fetch = async (url, init) => {
    requests.push({ url, init, rows: JSON.parse(init.body) });
    return { ok: status >= 200 && status < 300, status, text: async () => body };
  };
  return { fetch, requests };
}

/** Runs main and keeps what it printed. */
async function run(argv, { env = ENV, store = fakeStore(), now = () => 1_700_000_000_000 } = {}) {
  const out = [];
  const err = [];
  const exit = await main(argv, {
    env,
    fetch: store.fetch,
    now,
    out: (line) => out.push(line),
    err: (line) => err.push(line),
  });
  return { exit, out, err, store };
}

test("--platform web --count N prints N new codes, each once, and exits 0", async () => {
  const { exit, out } = await run(["--platform", "web", "--count", "5"]);
  assert.equal(exit, 0);
  assert.equal(out.length, 5);
  for (const line of out) assert.match(line, SHAPE);
  assert.equal(new Set(out).size, 5);
});

test("writes one batch of rows holding only each code's hash, its platform and when it was made", async () => {
  const { out, store } = await run(["--platform", "web", "--count", "3"]);
  assert.equal(store.requests.length, 1, "the whole batch is saved at once, so it saves fully or not at all");
  const { url, init, rows } = store.requests[0];
  assert.equal(url, `${URL}/rest/v1/gift_code`);
  assert.equal(init.method, "POST");
  assert.deepEqual(
    rows,
    out.map((code) => ({
      code_hash: sha256(code.replaceAll("-", "")),
      platform: "web",
      created_at: 1_700_000_000_000,
    })),
  );
  for (const code of out) assert.ok(!init.body.includes(code.replaceAll("-", "")), "no plain code is stored");
});

test("sends the service role key from the environment and never prints it", async () => {
  const { out, err, store } = await run(["--platform", "web", "--count", "2"]);
  const { headers } = store.requests[0].init;
  assert.equal(headers.apikey, KEY);
  assert.equal(headers.Authorization, `Bearer ${KEY}`);
  assert.equal(headers.Prefer, "return=minimal");
  assert.ok(![...out, ...err].join("\n").includes(KEY));
});

test("a failed save prints no codes, names only the status and error code, and exits 1", async () => {
  const store = fakeStore(409, JSON.stringify({ code: "23505", message: `duplicate key ${KEY}`, details: "hash" }));
  const { exit, out, err } = await run(["--platform", "web", "--count", "2"], { store });
  assert.equal(exit, 1);
  assert.deepEqual(out, []);
  assert.equal(err.length, 1);
  assert.match(err[0], /409/);
  assert.match(err[0], /23505/);
  assert.ok(!err[0].includes(KEY));
  assert.ok(!err[0].includes("duplicate key"), "the database's own message is never echoed");
});

test("a store that does not answer prints no codes and none of the thrown text", async () => {
  const store = {
    fetch: async () => {
      throw new Error(`connect failed ${KEY}`);
    },
  };
  const { exit, out, err } = await run(["--platform", "web", "--count", "2"], { store });
  assert.equal(exit, 1);
  assert.deepEqual(out, []);
  assert.ok(!err.join("\n").includes(KEY));
});

test("without the URL or the service role key it stops before making codes", async () => {
  for (const env of [{ SUPABASE_URL: URL }, { SUPABASE_SERVICE_ROLE_KEY: KEY }, {}]) {
    const store = fakeStore();
    const { exit, out, err } = await run(["--platform", "web", "--count", "2"], { env, store });
    assert.equal(exit, 1);
    assert.deepEqual(out, []);
    assert.equal(store.requests.length, 0);
    assert.match(err[0], /SUPABASE_(URL|SERVICE_ROLE_KEY)/);
    assert.ok(!err.join("\n").includes(KEY));
  }
});

test("accepts the URL and key under the names `supabase status -o env` prints", async () => {
  const store = fakeStore();
  const { exit } = await run(["--platform", "web", "--count", "1"], {
    env: { API_URL: URL, SERVICE_ROLE_KEY: KEY },
    store,
  });
  assert.equal(exit, 0);
  assert.equal(store.requests[0].url, `${URL}/rest/v1/gift_code`);
});

test("parseArgs takes --platform web and a whole --count from 1 to 1000", () => {
  assert.deepEqual(parseArgs(["--platform", "web", "--count", "10"]), { platform: "web", count: 10 });
  assert.deepEqual(parseArgs(["--count", "1000", "--platform", "web"]), { platform: "web", count: 1000 });
});

test("parseArgs refuses other platforms, a missing or bad count, and unknown flags, with words", () => {
  for (const argv of [
    ["--platform", "steam", "--count", "1"],
    ["--count", "1"],
    ["--platform", "web"],
    ["--platform", "web", "--count", "0"],
    ["--platform", "web", "--count", "1001"],
    ["--platform", "web", "--count", "2.5"],
    ["--platform", "web", "--count", "ten"],
    ["--platform", "web", "--count", "1", "--force"],
  ]) {
    assert.throws(() => parseArgs(argv), /usage|platform|count|unknown/i, argv.join(" "));
  }
});

test("bad arguments print the usage line and exit 1, without touching the store", async () => {
  const store = fakeStore();
  const { exit, out, err } = await run(["--platform", "steam", "--count", "1"], { store });
  assert.equal(exit, 1);
  assert.deepEqual(out, []);
  assert.equal(store.requests.length, 0);
  assert.match(err.join("\n"), /web/);
});

test("a project URL ending in slashes still posts to its gift_code table", async () => {
  const { exit, store } = await run(["--platform", "web", "--count", "1"], {
    env: { ...ENV, SUPABASE_URL: `${URL}//` },
  });
  assert.equal(exit, 0);
  assert.equal(store.requests[0].url, `${URL}/rest/v1/gift_code`);
});
