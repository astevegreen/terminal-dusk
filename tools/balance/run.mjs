// `node tools/balance/run.mjs [--games <n>] [--seed <base>] [--turns <n>] [--plays <n>] [--era <id>@<turn|off>]
// [--json]`: plays n seeded Easy-vs-Easy games of the first-deck TEST scenario and prints results by side,
// per-card statistics and per-era card use. See tools/balance/README.md.
import { firstDeckCardName, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { balanceConfig, describeSetup, ERA_IDS, eraCards, FIRST_ERA, setupNumbers } from "./config.mjs";
import { playBalanceGame } from "./play.mjs";
import { formatText } from "./report.mjs";
import { balanceStats } from "./stats.mjs";

export const USAGE =
  "Usage: node tools/balance/run.mjs [--games <positive whole number>] [--seed <base>] " +
  "[--turns <positive whole number>] [--plays <positive whole number>] " +
  "[--era <era id>@<positive whole number or off>]... [--json]";
const DEFAULTS = { games: 200, seed: "balance", json: false };
const WHOLE = /^[1-9]\d*$/;
const refuse = (message) => new Error(`${message}\n${USAGE}`);

/** The new arrival turn for one `--era` value, as [era id, turn or null for "off"]. */
function parseEra(value, eras) {
  const parts = value.split("@");
  const [era, turn] = parts;
  if (parts.length !== 2 || era === "" || !(turn === "off" || WHOLE.test(turn))) {
    throw refuse(`--era must look like <era id>@<turn> or <era id>@off, not "${value}".`);
  }
  if (era === FIRST_ERA) throw refuse(`--era cannot move ${FIRST_ERA}: the first era is always in from turn 1.`);
  if (!ERA_IDS.includes(era)) throw refuse(`--era names ${era}, which the first-deck setup does not have.`);
  if (era in eras) throw refuse(`--era names ${era} more than once.`);
  return [era, turn === "off" ? null : Number(turn)];
}

/** The options from the command line; throws a message with the usage line when they are wrong. */
export function parseArgs(argv) {
  const options = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (!["--games", "--seed", "--turns", "--plays", "--era"].includes(arg)) throw refuse(`Unknown argument "${arg}".`);
    const value = argv[++i];
    if (value === undefined) throw refuse(`${arg} needs a value.`);
    if (arg === "--seed") options.seed = value;
    else if (arg === "--era") {
      options.eras ??= {};
      const [era, turn] = parseEra(value, options.eras);
      options.eras[era] = turn;
    } else if (WHOLE.test(value)) options[arg.slice(2)] = Number(value);
    else throw refuse(`${arg} must be a positive whole number, not "${value}".`);
  }
  return options;
}

/**
 * Plays the run's games and returns the report numbers, with the turns, plays per turn and era arrival turns
 * actually used under `setup`.
 */
export function runBalance({ games, seed, turns, plays, eras }) {
  const config = balanceConfig({ turns, plays, eras });
  const setup = setupNumbers(config);
  const summaries = Array.from({ length: games }, (_, i) => playBalanceGame(seed, i, config));
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
