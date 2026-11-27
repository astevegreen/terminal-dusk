// The finder behind the entitlement audit (onlineDoors.audit.test.ts, #687): it reads server source and migration
// text and lists every place that opens an online game, makes a match, or deals with ranked play. It is a text
// scan, so it knows the ways this server writes today: a new way of writing a match row needs a pattern here.

/** File path (from packages/server) to file text. */
export type Sources = Record<string, string>;

const RANKED = /ranked|matchmak|\bseek/i;
const SQL_FUNCTION = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)[\s\S]*?\bas\s+(\$\w*\$)([\s\S]*?)\2/gi;
const SQL_WRITE = /\b(?:insert\s+into|merge\s+into|copy)\s+(?:only\s+)?(?:"?public"?\.)?"?(match_invite|match)\b/gi;
const TABLE_WRITE = /\.from\(\s*["'`](match_invite|match)["'`]\s*\)\s*\.\s*(?:insert|upsert)\b/g;
const INVITE_CALL = /\binvites\s*\.\s*(save|accept)\s*\(/g;
const RPC_CALL = /\.rpc\(\s*["'`](\w+)["'`]/g;
const MAKER_IMPORT = /\bimport\b[^;]*?\{[^}]*\bhostCreate\b[^}]*\}\s*from\b/;

const sqlCode = (text: string): string => text.replace(/--.*$/gm, "");
// A `//` counts as a comment only at the start of a line or after a space, so the one in a URL is kept.
const tsCode = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
const tablesWritten = (sql: string): string[] => [...sql.matchAll(SQL_WRITE)].map((hit) => hit[1]!.toLowerCase());

/**
 * Every marker found, sorted and without repeats. A SQL function that writes a new `match` or `match_invite` row
 * is named once, however many migrations redefine it; a call to it from TypeScript is a marker of its own.
 */
export function findMatchMakers(sources: Sources): string[] {
  const found = new Set<string>();
  const writers = new Set<string>();
  const entries = Object.entries(sources);

  for (const [file, text] of entries.filter(([name]) => name.endsWith(".sql"))) {
    const code = sqlCode(text);
    for (const [, name, , body] of code.matchAll(SQL_FUNCTION)) {
      for (const table of tablesWritten(body!)) {
        writers.add(name!);
        found.add(`sql: function ${name} writes new ${table} rows`);
      }
    }
    for (const table of tablesWritten(code.replace(SQL_FUNCTION, ""))) {
      found.add(`${file}: writes new ${table} rows outside a function`);
    }
    if (RANKED.test(code)) found.add(`${file}: ranked or matchmaking code`);
  }

  for (const [file, text] of entries.filter(([name]) => !name.endsWith(".sql"))) {
    const code = tsCode(text);
    if (MAKER_IMPORT.test(code)) found.add(`${file}: imports hostCreate`);
    for (const [, table] of code.matchAll(TABLE_WRITE)) found.add(`${file}: writes new ${table} rows`);
    for (const [, call] of code.matchAll(INVITE_CALL)) found.add(`${file}: calls invites.${call}`);
    for (const [, name] of code.matchAll(RPC_CALL)) if (writers.has(name!)) found.add(`${file}: calls ${name}`);
    if (RANKED.test(code)) found.add(`${file}: ranked or matchmaking code`);
  }
  return [...found].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** True for a marker of ranked play, which belongs to a "ranked" door. */
export const isRankedMarker = (marker: string): boolean => RANKED.test(marker);
