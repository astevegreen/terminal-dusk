// The finder behind the entitlement audit (onlineDoors.audit.test.ts, #687): it reads server source and migration
// text and lists every place that opens an online game, makes a match, or deals with ranked play. It is a text
// scan, so it knows the ways this server writes today: a new way of writing a match row needs a pattern here.

/** File path (from packages/server) to file text. */
export type Sources = Record<string, string>;

const RANKED = /ranked|matchmak|\bseek/i;
/** Each whole word holding a ranked word, so a marker names them all and a new one in a listed file still shows. */
const RANKED_WORDS = /\b\w*(?:ranked|matchmak)\w*|\bseek\w*/gi;
const SQL_HEADER = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)/gi;
const SQL_BODY_START = /\bas\s+(\$\w*\$)/gi;
const SQL_WRITE = /\b(?:insert\s+into|merge\s+into|copy)\s+(?:only\s+)?(?:"?public"?\.)?"?(match_invite|match)\b/gi;
const TABLE_WRITE = /\.from\(\s*["'`](match_invite|match)["'`]\s*\)\s*\.\s*(?:insert|upsert)\b/g;
const INVITE_CALL = /\binvites\s*\.\s*(save|accept)\s*\(/g;
const RPC_CALL = /\.rpc\(\s*["'`](\w+)["'`]/g;
// Any mention counts, so a namespace or dynamic import of the host cannot slip past.
const MAKER_NAME = /\bhostCreate\b/;
const MAKER_CALL = /\bhostCreate\s*\(/g;

const sqlCode = (text: string): string => text.replace(/--.*/g, "");
// A `//` counts as a comment only at the start of a line or after a space, so the one in a URL is kept.
const tsCode = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*/gm, "$1");
const tablesWritten = (sql: string): string[] => [...sql.matchAll(SQL_WRITE)].map((hit) => hit[1]!.toLowerCase());
const rankedMarker = (file: string, code: string): string => {
  const words = [...new Set(Array.from(code.matchAll(RANKED_WORDS), (hit) => hit[0]))].sort(byCodeUnit);
  return `${file}: ranked or matchmaking code (${words.join(", ")})`;
};
const byCodeUnit = (a: string, b: string): number => {
  if (a < b) return -1;
  return a > b ? 1 : 0;
};

/** Each SQL function's name and dollar-quoted body, and the SQL left outside those bodies. */
function splitFunctions(code: string): { functions: { name: string; body: string }[]; outside: string } {
  const functions: { name: string; body: string }[] = [];
  let outside = "";
  let end = 0;
  for (const header of code.matchAll(SQL_HEADER)) {
    if (header.index < end) continue;
    SQL_BODY_START.lastIndex = header.index;
    const tag = SQL_BODY_START.exec(code)?.[1];
    if (tag === undefined) break;
    const from = SQL_BODY_START.lastIndex;
    const to = code.indexOf(tag, from);
    if (to < 0) break;
    functions.push({ name: header[1]!, body: code.slice(from, to) });
    outside += code.slice(end, header.index);
    end = to + tag.length;
  }
  return { functions, outside: outside + code.slice(end) };
}

/** Marks the new rows one SQL file writes, and adds each function that writes them to `writers`. */
function readSql(file: string, code: string, found: Set<string>, writers: Set<string>): void {
  const { functions, outside } = splitFunctions(code);
  for (const { name, body } of functions) {
    for (const table of tablesWritten(body)) {
      writers.add(name);
      found.add(`sql: function ${name} writes new ${table} rows`);
    }
  }
  for (const table of tablesWritten(outside)) found.add(`${file}: writes new ${table} rows outside a function`);
}

/** Each match-making call and table write in one TypeScript file, once per occurrence. */
function tsCalls(file: string, code: string, writers: Set<string>): string[] {
  const rpcs = Array.from(code.matchAll(RPC_CALL), (hit) => hit[1]!).filter((name) => writers.has(name));
  return [
    ...Array.from(code.matchAll(MAKER_CALL), () => `${file}: calls hostCreate`),
    ...Array.from(code.matchAll(TABLE_WRITE), (hit) => `${file}: writes new ${hit[1]} rows`),
    ...Array.from(code.matchAll(INVITE_CALL), (hit) => `${file}: calls invites.${hit[1]}`),
    ...rpcs.map((name) => `${file}: calls ${name}`),
  ];
}

/**
 * Every marker found, sorted. Each call or table write in TypeScript is listed once per occurrence, so a second
 * one in a file that a door already covers still shows. A SQL function that writes a new `match` or
 * `match_invite` row is named once, however many migrations redefine it.
 */
export function findMatchMakers(sources: Sources): string[] {
  const found = new Set<string>();
  const calls: string[] = [];
  const writers = new Set<string>();
  const entries = Object.entries(sources);

  for (const [file, text] of entries.filter(([name]) => name.endsWith(".sql"))) {
    const code = sqlCode(text);
    readSql(file, code, found, writers);
    if (RANKED.test(code)) found.add(rankedMarker(file, code));
  }

  for (const [file, text] of entries.filter(([name]) => !name.endsWith(".sql"))) {
    const code = tsCode(text);
    if (MAKER_NAME.test(code)) found.add(`${file}: names hostCreate`);
    calls.push(...tsCalls(file, code, writers));
    if (RANKED.test(code)) found.add(rankedMarker(file, code));
  }
  return [...found, ...calls].sort(byCodeUnit);
}

/** True for a marker of ranked play, which belongs to a "ranked" door. */
export const isRankedMarker = (marker: string): boolean => RANKED.test(marker);
