// `node tools/balance/run.mjs [--games <n>] [--seed <base>] [--turns <n>] [--plays <n>] [--era <id>@<turn|off>]
// [--json]`: plays n seeded Easy-vs-Easy games of the first-deck TEST scenario and prints results by side, per-card
// statistics and card use per era. See tools/balance/README.md.
import { firstDeckCardName, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { ERA_IDS, FIRST_ERA, balanceConfig, describeSetup, eraCards, setupNumbers } from "./config.mjs";
import { playBalanceGame } from "./play.mjs";
import { formatText } from "./report.mjs";
import { balanceStats } from "./stats.mjs";

export const USAGE =
  "Usage: node tools/balance/run.mjs [--games <positive whole number>] [--seed <base>] [--turns <n>] [--plays <n>]" +
  " [--era <era-id>@<turn> | --era <era-id>@off ...] [--json]";
const DEFAULTS = { games: 200, seed: "balance", json: false };
const WHOLE = /^[1-9]\d*$/;
const NUMBER_OPTIONS = { "--games": "games", "--turns": "turns", "--plays": "plays" };

/** The options from the command line; throws a message with the usage line when they are wrong. */
export function parseArgs(argv) {
  const options = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg !== "--seed" && arg !== "--era" && !(arg in NUMBER_OPTIONS)) {
      throw new Error(`Unknown argument "${arg}".\n${USAGE}`);
    }
    const value = argv[++i];
    if (value === undefined) throw new Error(`${arg} needs a value.\n${USAGE}`);
    if (arg === "--seed") options.seed = value;
    else if (arg === "--era") addEra(options, value);
    else if (WHOLE.test(value)) options[NUMBER_OPTIONS[arg]] = Number(value);
    else throw new Error(`${arg} must be a positive whole number, not "${value}".\n${USAGE}`);
  }
  return options;
}

/** Adds one `--era <era-id>@<turn>` or `--era <era-id>@off` to `options.eras` (turn, or null for left out). */
function addEra(options, value) {
  const match = /^([^@]+)@([^@]+)$/.exec(value);
  if (match === null || (match[2] !== "off" && !WHOLE.test(match[2]))) {
    throw new Error(`--era must be <era-id>@<positive whole number> or <era-id>@off, not "${value}".\n${USAGE}`);
  }
  const [, era, turn] = match;
  if (era === FIRST_ERA) throw new Error(`${FIRST_ERA} is always in from turn 1; it cannot be moved.\n${USAGE}`);
  if (!ERA_IDS.includes(era)) {
    throw new Error(`The first-deck setup has no era "${era}" (it has ${ERA_IDS.join(", ")}).\n${USAGE}`);
  }
  options.eras ??= {};
  if (era in options.eras) throw new Error(`--era names ${era} more than once.\n${USAGE}`);
  options.eras[era] = turn === "off" ? null : Number(turn);
}

/**
 * Plays the run's games and returns the report numbers, with the turns, plays per turn and era arrival turns the
 * games used under `setup`, and card use per era under `byEra`.
 */
export function runBalance(options) {
  const config = balanceConfig(options);
  const setup = setupNumbers(config);
  const summaries = Array.from({ length: options.games }, (_, i) => playBalanceGame(options.seed, i, config));
  const stats = balanceStats(summaries, {
    cards: firstDeckRuleset.cards.map((c) => c.id),
    nameOf: firstDeckCardName,
    eras: eraCards(setup),
  });
  return { setup, ...stats };
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
    const title =
      `Balance report, first deck TEST scenario (placeholder numbers), base seed "${options.seed}", ` +
      describeSetup(stats.setup);
    process.stdout.write(options.json ? `${JSON.stringify(stats, null, 2)}\n` : formatText(stats, title));
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}
