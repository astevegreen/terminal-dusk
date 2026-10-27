// `node tools/balance/run.mjs [--scenario <first-deck|test-map>] [--games <n>] [--seed <base>] [--turns <n>]
// [--plays <n>] [--era <id>@<turn|off>] [--json]`: plays n seeded Easy-vs-Easy games of the chosen scenario (by
// default the first-deck TEST scenario) and prints results by side, per-card statistics, per-era card use and, on
// a scenario with a map, the map numbers. See tools/balance/README.md.
import { firstDeckCardName, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { balanceConfig, DEFAULT_SCENARIO, describeSetup, eraCards, eraIdsOf, FIRST_ERA } from "./config.mjs";
import { SCENARIOS, setupNumbers } from "./config.mjs";
import { playBalanceGame } from "./play.mjs";
import { formatText } from "./report.mjs";
import { balanceStats } from "./stats.mjs";

export const USAGE =
  "Usage: node tools/balance/run.mjs [--scenario <first-deck or test-map>] [--games <positive whole number>] " +
  "[--seed <base>] [--turns <positive whole number>] [--plays <positive whole number>] " +
  "[--era <era id>@<positive whole number or off>]... [--json]";
const DEFAULTS = { games: 200, seed: "balance", json: false };
const VALUED = ["--scenario", "--games", "--seed", "--turns", "--plays", "--era"];
const WHOLE = /^[1-9]\d*$/;
const refuse = (message) => new Error(`${message}\n${USAGE}`);

/** The new arrival turn for one `--era` value, as [era id, turn or null for "off"], on `scenario`. */
function parseEra(value, eras, scenario) {
  const parts = value.split("@");
  const [era, turn] = parts;
  if (parts.length !== 2 || era === "" || !(turn === "off" || WHOLE.test(turn))) {
    throw refuse(`--era must look like <era id>@<turn> or <era id>@off, not "${value}".`);
  }
  if (era === FIRST_ERA) throw refuse(`--era cannot move ${FIRST_ERA}: the first era is always in from turn 1.`);
  if (!eraIdsOf(scenario).includes(era)) throw refuse(`--era names ${era}, which the ${scenario} setup does not have.`);
  if (era in eras) throw refuse(`--era names ${era} more than once.`);
  return [era, turn === "off" ? null : Number(turn)];
}

/** The options from the command line; throws a message with the usage line when they are wrong. */
export function parseArgs(argv) {
  const options = { ...DEFAULTS };
  const eraValues = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (!VALUED.includes(arg)) throw refuse(`Unknown argument "${arg}".`);
    const value = argv[++i];
    if (value === undefined) throw refuse(`${arg} needs a value.`);
    if (arg === "--seed") options.seed = value;
    else if (arg === "--era") eraValues.push(value);
    else if (arg === "--scenario") {
      if (!SCENARIOS.includes(value)) {
        throw refuse(`--scenario must be one of ${SCENARIOS.join(", ")}, not "${value}".`);
      }
      options.scenario = value;
    } else if (WHOLE.test(value)) options[arg.slice(2)] = Number(value);
    else throw refuse(`${arg} must be a positive whole number, not "${value}".`);
  }
  // The eras are checked once the scenario is known, wherever --scenario stands on the line.
  for (const value of eraValues) {
    options.eras ??= {};
    const [era, turn] = parseEra(value, options.eras, options.scenario ?? DEFAULT_SCENARIO);
    options.eras[era] = turn;
  }
  return options;
}

/**
 * Plays the run's games and returns the report numbers, with the turns, plays per turn and era arrival turns
 * actually used under `setup`. `createPlayer` (optional) replaces the Easy AI, for tests.
 */
export function runBalance({ scenario = DEFAULT_SCENARIO, games, seed, turns, plays, eras }, { createPlayer } = {}) {
  const config = balanceConfig({ scenario, turns, plays, eras });
  const setup = setupNumbers(config, scenario);
  const summaries = Array.from({ length: games }, (_, i) => playBalanceGame(seed, i, config, { createPlayer }));
  // One row per card of the scenario's eras (every first-deck card on first-deck; Era 1's on the test map).
  const ofScenario = new Set(eraIdsOf(scenario));
  const stats = balanceStats(summaries, {
    cards: firstDeckRuleset.cards.filter((c) => ofScenario.has(c.era)).map((c) => c.id),
    nameOf: firstDeckCardName,
    eras: eraCards(setup),
  });
  return { setup, ...stats };
}

/** The report's first line, before the game count: the scenario, the base seed and the setup used. */
export function reportTitle(scenario, seed, setup) {
  const what =
    scenario === "test-map"
      ? "test-map scenario (a made-up test map, not the game's map: a smoke check, not a verdict on balance)"
      : "first deck TEST scenario (placeholder numbers)";
  return `Balance report, ${what}, base seed "${seed}", ${describeSetup(setup)}`;
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
    const title = reportTitle(options.scenario ?? DEFAULT_SCENARIO, options.seed, stats.setup);
    process.stdout.write(options.json ? `${JSON.stringify(stats, null, 2)}\n` : formatText(stats, title));
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}
