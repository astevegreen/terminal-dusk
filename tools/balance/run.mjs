// `node tools/balance/run.mjs [--games <n>] [--seed <base>] [--json]`: plays n seeded Easy-vs-Easy games of the
// first-deck TEST scenario and prints results by side and per-card statistics. See tools/balance/README.md.
import { firstDeckCardName, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { playBalanceGame } from "./play.mjs";
import { formatText } from "./report.mjs";
import { balanceStats } from "./stats.mjs";

export const USAGE = "Usage: node tools/balance/run.mjs [--games <positive whole number>] [--seed <base>] [--json]";
const DEFAULTS = { games: 200, seed: "balance", json: false };

/** The options from the command line; throws a message with the usage line when they are wrong. */
export function parseArgs(argv) {
  const options = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") options.json = true;
    else if (arg === "--games" || arg === "--seed") {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${arg} needs a value.\n${USAGE}`);
      if (arg === "--seed") options.seed = value;
      else if (/^[1-9]\d*$/.test(value)) options.games = Number(value);
      else throw new Error(`--games must be a positive whole number, not "${value}".\n${USAGE}`);
    } else throw new Error(`Unknown argument "${arg}".\n${USAGE}`);
  }
  return options;
}

/** Plays the run's games and returns the report numbers. */
export function runBalance({ games, seed }) {
  const summaries = Array.from({ length: games }, (_, i) => playBalanceGame(seed, i));
  return balanceStats(summaries, { cards: firstDeckRuleset.cards.map((c) => c.id), nameOf: firstDeckCardName });
}

if (import.meta.main) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
  try {
    const stats = runBalance(options);
    const title = `Balance report, first deck TEST scenario (placeholder numbers), base seed "${options.seed}"`;
    process.stdout.write(options.json ? `${JSON.stringify(stats, null, 2)}\n` : formatText(stats, title));
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}
