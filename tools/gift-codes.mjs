#!/usr/bin/env node
// Makes a batch of gift codes (docs/architecture.md, Decision 7, "Free copies"): it saves each code's hash in the
// gift_code table and prints the plain codes once, for the owner to hand out. The database never sees a plain code,
// and nothing can print them again, so keep the output.
//
//   node tools/gift-codes.mjs --platform web --count 20
//
// It reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment (or API_URL and SERVICE_ROLE_KEY, the
// names `supabase status -o env` prints) and never prints the key. The batch is saved in one request, so it saves
// fully or not at all, and the codes are printed only after it saved.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { giftCode, hashGiftCode, normalizeGiftCode } from "../packages/server/src/giftCode.ts";

const USAGE = "Usage: node tools/gift-codes.mjs --platform web --count <1-1000>";
const MAX_COUNT = 1000;

/** The platform and count from the command line. Throws with the usage line when they are not right. */
export function parseArgs(argv) {
  const options = {};
  for (let at = 0; at < argv.length; at += 2) {
    const flag = argv[at];
    if (flag !== "--platform" && flag !== "--count") throw new Error(`Unknown option ${flag}. ${USAGE}`);
    options[flag.slice(2)] = argv[at + 1];
  }
  if (options.platform !== "web") throw new Error(`Gift codes are for the web platform only. ${USAGE}`);
  const count = Number(options.count);
  if (!/^\d+$/.test(options.count ?? "") || count < 1 || count > MAX_COUNT) {
    throw new Error(`The count must be a whole number from 1 to ${MAX_COUNT}. ${USAGE}`);
  }
  return { platform: "web", count };
}

/** Makes, saves and prints the codes. Returns the exit code. Everything outside the process is passed in. */
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
  const codes = new Set();
  while (codes.size < options.count) codes.add(giftCode());
  const createdAt = now();
  const rows = await Promise.all(
    [...codes].map(async (code) => ({
      code_hash: await hashGiftCode(normalizeGiftCode(code)),
      platform: options.platform,
      created_at: createdAt,
    })),
  );
  const saved = await save(fetch, url, key, rows);
  if (saved !== null) {
    err(`The codes were not saved (${saved}), so none are printed. Nothing was written.`);
    return 1;
  }
  for (const code of codes) out(code);
  return 0;
}

/** The URL without any slashes at its end, so a path can follow it. */
function withoutTrailingSlashes(url) {
  let end = url.length;
  while (end > 0 && url[end - 1] === "/") end--;
  return url.slice(0, end);
}

/** Saves the rows in one request: null when it worked, else the status and database error code, nothing more. */
async function save(fetch, url, key, rows) {
  let response;
  try {
    response = await fetch(`${withoutTrailingSlashes(url)}/rest/v1/gift_code`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(rows),
    });
  } catch {
    return "the database did not answer";
  }
  if (response.ok) return null;
  return `status ${response.status}${await errorCode(response)}`;
}

/** The PostgREST error code in the reply, if it has a plain one. Its message and details are never read out. */
async function errorCode(response) {
  try {
    const { code } = JSON.parse(await response.text());
    return typeof code === "string" && /^[\w.-]{1,16}$/.test(code) ? `, error ${code}` : "";
  } catch {
    return "";
  }
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
