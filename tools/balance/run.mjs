// `node tools/balance/run.mjs [--scenario <first-deck|test-map|six-region>] [--games <n>] [--seed <base>]
// [--turns <n>] [--plays <n>] [--era <id>@<turn|off>] [--numbers <file>] [--json]`: plays n seeded Easy-vs-Easy
// games of the chosen scenario (by default the first-deck TEST scenario) and prints results by side, per-card
// statistics, per-era card use and, on a scenario with a map, the map numbers and the region levels at each era's
// end. See tools/balance/README.md.
import { firstDeckCardName, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { balanceConfig, DEFAULT_SCENARIO, describeSetup, eraCards, eraIdsOf, FIRST_ERA } from "./config.mjs";
import { SCENARIOS, setupNumbers } from "./config.mjs";
import { readNumbers } from "./numbers.mjs";
import { playBalanceGame, TIERS } from "./play.mjs";
import { formatText } from "./report.mjs";
import { balanceStats } from "./stats.mjs";

export const USAGE =
  "Usage: node tools/balance/run.mjs [--scenario <first-deck, test-map or six-region>] " +
  "[--games <positive whole number>] [--seed <base>] [--turns <positive whole number>] " +
  "[--plays <positive whole number>] [--era <era id>@<positive whole number or off>]... [--numbers <file>] [--lio-tier <easy or medium>] [--sae-tier <easy or medium>] [--json]";
const DEFAULTS = { games: 200, seed: "balance", json: false };
const VALUED = new Set([
  "--scenario",
  "--games",
  "--seed",
  "--turns",
  "--plays",
  "--era",
  "--numbers",
  "--lio-tier",
  "--sae-tier",
]);
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
    if (!VALUED.has(arg)) throw refuse(`Unknown argument "${arg}".`);
    const value = argv[++i];
    if (value === undefined) throw refuse(`${arg} needs a value.`);
    if (arg === "--seed") options.seed = value;
    else if (arg === "--numbers") options.numbersFile = value;
    else if (arg === "--era") eraValues.push(value);
    else if (arg === "--lio-tier" || arg === "--sae-tier") {
      if (!Object.hasOwn(TIERS, value)) {
        throw refuse(`${arg} must be one of ${Object.keys(TIERS).join(", ")}, not "${value}".`);
      }
      options.tiers = { ...options.tiers, [arg.slice(2, 5)]: value };
    } else if (arg === "--scenario") {
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
  if (options.numbersFile !== undefined && (options.scenario ?? DEFAULT_SCENARIO) === DEFAULT_SCENARIO) {
    throw refuse("--numbers needs a scenario with a map: --scenario test-map or --scenario six-region.");
  }
  return options;
}

/**
 * Plays the run's games and returns the report numbers, with the turns, plays per turn and era arrival turns
 * actually used under `setup`. `numbers` (optional) is a numbers file's content (numbers.mjs). `createPlayer`
 * (optional) replaces the Easy AI, for tests.
 */
export function runBalance(options, { createPlayer } = {}) {
  const { scenario = DEFAULT_SCENARIO, games, seed, turns, plays, eras, numbers, tiers } = options;
  const config = balanceConfig({ scenario, turns, plays, eras, numbers });
  const setup = setupNumbers(config, scenario);
  const summaries = Array.from({ length: games }, (_, i) => playBalanceGame(seed, i, config, { createPlayer, tiers }));
  // One row per card of the scenario's eras (every first-deck card on first-deck; Era 1's on the test map).
  const ofScenario = new Set(eraIdsOf(scenario));
  const stats = balanceStats(summaries, {
    cards: firstDeckRuleset.cards.filter((c) => ofScenario.has(c.era)).map((c) => c.id),
    nameOf: firstDeckCardName,
    eras: eraCards(setup),
  });
  if (tiers === undefined) return { setup, ...stats };
  const crises = { lio: 0, sae: 0 };
  for (const game of summaries) for (const side of Object.keys(crises)) crises[side] += game.crises[side];
  return { setup, ...stats, tiers: { lio: tiers.lio ?? "easy", sae: tiers.sae ?? "easy" }, crises };
}

const SCENARIO_TITLES = {
  "first-deck": "first deck TEST scenario (placeholder numbers)",
  "test-map": "test-map scenario (a made-up test map, not the game's map: a smoke check, not a verdict on balance)",
  "six-region":
    "six-region map with the first deck (a smoke check of influence and control, and of the score track when a " +
    "numbers file gives the map scoring: not a verdict on balance)",
};

/**
 * The report's first line, before the game count: the scenario, the numbers file's name when the run had one, the
 * base seed and the setup used.
 */
export function reportTitle(scenario, seed, setup, numbersName) {
  const numbers = numbersName === undefined ? "" : `, numbers "${numbersName}"`;
  return `Balance report, ${SCENARIO_TITLES[scenario]}${numbers}, base seed "${seed}", ${describeSetup(setup)}`;
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
    const { numbersFile, ...rest } = options;
    const numbers = numbersFile === undefined ? undefined : readNumbers(numbersFile);
    const stats = runBalance({ ...rest, numbers });
    const numbersName = numbers === undefined ? undefined : (numbers.name ?? numbersFile);
    const title = reportTitle(options.scenario ?? DEFAULT_SCENARIO, options.seed, stats.setup, numbersName);
    process.stdout.write(options.json ? `${JSON.stringify(stats, null, 2)}\n` : formatText(stats, title));
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}
