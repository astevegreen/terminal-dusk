#!/usr/bin/env node
// Settles web purchases nobody could be matched to (docs/architecture.md, Decision 7, "Accounts and purchases"): when
// Paddle's webhook carries no known player id, the receipt waits in the checkout_unmatched table. This tool lists
// those receipts and gives one to a named player.
//
//   node tools/unmatched-receipts.mjs list
//   node tools/unmatched-receipts.mjs grant --receipt <id> --player <uuid>
//
// It reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment (or API_URL and SERVICE_ROLE_KEY, the
// names `supabase status -o env` prints) and never prints the key. A grant is one call to the grant_unmatched_receipt
// SQL function, which runs in one transaction: it grants fully or changes nothing.
// The table holds only the receipt, why no player was found, and when; it keeps no amount, currency or buyer hint,
// so the list shows those.
import path from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = "Usage: node tools/unmatched-receipts.mjs list | grant --receipt <id> --player <uuid>";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REFUSALS = {
  unknownReceipt: "There is no unmatched receipt with that id. Nothing was changed.",
  already: "That receipt has already been granted. Nothing was changed.",
  unknownPlayer: "There is no player with that id. Nothing was changed.",
  refunded: "That receipt was refunded, so it gets no copy. Nothing was changed.",
  chargedBack: "That receipt was charged back, so it gets no copy now. Nothing was changed.",
};

/** The command and its options from the command line. Throws with the usage line when they are not right. */
export function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (command === "list") {
    if (rest.length > 0) throw new Error(`The list command takes no options. ${USAGE}`);
    return { command };
  }
  if (command !== "grant") throw new Error(`Unknown command ${command ?? "(none)"}. ${USAGE}`);
  const options = {};
  for (let at = 0; at < rest.length; at += 2) {
    const flag = rest[at];
    if (flag !== "--receipt" && flag !== "--player") throw new Error(`Unknown option ${flag}. ${USAGE}`);
    options[flag.slice(2)] = rest[at + 1];
  }
  if (!options.receipt || options.receipt.startsWith("--"))
    throw new Error(`Name the receipt with --receipt. ${USAGE}`);
  if (!UUID.test(options.player ?? "")) throw new Error(`The player must be a UUID, given with --player. ${USAGE}`);
  return { command, receipt: options.receipt, player: options.player.toLowerCase() };
}

/** Runs the command. Returns the exit code. Everything outside the process is passed in. */
export async function main(argv, { env, fetch, now, out, err }) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    err(error.message);
    return 1;
  }
  const url = env.SUPABASE_URL ?? env.API_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SERVICE_ROLE_KEY;
  if (!url || !key) {
    err("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the service role key, never a client key).");
    return 1;
  }
  const base = withoutTrailingSlashes(url);
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  return options.command === "list"
    ? list(fetch, base, headers, out, err)
    : grant(fetch, base, headers, options, now(), out, err);
}

async function list(fetch, base, headers, out, err) {
  const query = "select=source,receipt_ref,reason,created_at&order=created_at.asc,receipt_ref.asc";
  const reply = await call(fetch, `${base}/rest/v1/checkout_unmatched?${query}`, { method: "GET", headers });
  if (reply.failed) {
    err(`The receipts could not be read (${reply.failed}).`);
    return 1;
  }
  const rows = Array.isArray(reply.body) ? reply.body : [];
  if (rows.length === 0) {
    out("No unmatched receipts.");
    return 0;
  }
  for (const row of rows) {
    const time = Number.isSafeInteger(row.created_at) ? new Date(row.created_at).toISOString() : "unknown time";
    out(`${row.receipt_ref}  ${time}  ${row.source}  reason ${row.reason}  amount and currency: not recorded`);
  }
  return 0;
}

async function grant(fetch, base, headers, options, at, out, err) {
  const body = JSON.stringify({ p_receipt_ref: options.receipt, p_player: options.player, p_now: at });
  const reply = await call(fetch, `${base}/rest/v1/rpc/grant_unmatched_receipt`, { method: "POST", headers, body });
  if (reply.failed) {
    err(`The grant did not go through (${reply.failed}). Nothing was changed.`);
    return 1;
  }
  if (reply.body === "granted") {
    out(`Receipt ${options.receipt} now gives player ${options.player} the full game.`);
    return 0;
  }
  err(REFUSALS[reply.body] ?? "The database gave an answer this tool does not know. Nothing was changed.");
  return 1;
}

/** The URL without any slashes at its end, so a path can follow it. */
function withoutTrailingSlashes(url) {
  let end = url.length;
  while (end > 0 && url[end - 1] === "/") end--;
  return url.slice(0, end);
}

/** One request: { body } when it worked, else { failed } with the status and plain error code, nothing more. */
async function call(fetch, url, init) {
  let response;
  try {
    response = await fetch(url, init);
  } catch {
    return { failed: "the database did not answer" };
  }
  let text = "";
  try {
    text = await response.text();
  } catch {
    // An unreadable body reads as empty.
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = undefined;
  }
  if (response.ok) return { body: parsed };
  const code = typeof parsed?.code === "string" && /^[\w.-]{1,16}$/.test(parsed.code) ? `, error ${parsed.code}` : "";
  return { failed: `status ${response.status}${code}` };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2), {
    env: process.env,
    fetch: globalThis.fetch,
    now: Date.now,
    out: (line) => console.log(line),
    err: (line) => console.error(line),
  });
}
