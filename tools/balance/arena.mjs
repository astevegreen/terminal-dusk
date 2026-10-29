// `node tools/balance/arena.mjs [--a <tier>] [--b <tier>] [--games <n>] [--seed <base>] [--scenario <name>] [--json]`:
// the AI arena of Decision 8. Plays n seeded games of tier A against tier B through the match host (play.mjs), swaps
// the sides every game so neither tier gets the first-player edge, and reports win rate per tier and per side, draws
// and game length. Exits 1 when a Decision 8 gate that applies to the pairing fails. See tools/balance/README.md.
import { balanceConfig, DEFAULT_SCENARIO, SCENARIOS } from "./config.mjs";
import { playBalanceGame, SIDES, TIERS } from "./play.mjs";

export const USAGE =
  "Usage: node tools/balance/arena.mjs [--a <easy or medium>] [--b <easy or medium>] " +
  "[--games <positive whole number>] [--seed <base>] [--scenario <first-deck, test-map or six-region>] [--json]";
const DEFAULTS = { a: "medium", b: "easy", games: 100, seed: "arena", scenario: "six-region", json: false };
const VALUED = new Set(["--a", "--b", "--games", "--seed", "--scenario"]);
const WHOLE = /^[1-9]\d*$/;
const refuse = (message) => new Error(`${message}\n${USAGE}`);

/**
 * The Decision 8 gates that can be checked today. Each names the stronger tier, the weaker one and the share of
 * games (wins over all games, draws count against) the stronger must beat. Hard is not built yet.
 */
export const GATES = [{ strong: "medium", weak: "easy", over: 0.75 }];

/** The side tier `"a"` or `"b"` plays in game `i`: A takes LIO in even games and SAE in odd ones. */
export const sideOf = (which, i) => {
  const aSide = i % 2 === 0 ? "lio" : "sae";
  if (which === "a") return aSide;
  return aSide === "lio" ? "sae" : "lio";
};

/** The options from the command line; throws a message with the usage line when they are wrong. */
export function parseArgs(argv) {
  const options = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (!VALUED.has(arg)) throw refuse(`Unknown argument "${arg}".`);
    const value = argv[++i];
    if (value === undefined) throw refuse(`${arg} needs a value.`);
    if (arg === "--a" || arg === "--b") {
      if (!Object.hasOwn(TIERS, value)) {
        throw refuse(`${arg} must be one of ${Object.keys(TIERS).join(", ")}, not "${value}".`);
      }
      options[arg.slice(2)] = value;
    } else if (arg === "--scenario") {
      if (!SCENARIOS.includes(value)) {
        throw refuse(`--scenario must be one of ${SCENARIOS.join(", ")}, not "${value}".`);
      }
      options.scenario = value;
    } else if (arg === "--seed") options.seed = value;
    else if (WHOLE.test(value)) options.games = Number(value);
    else throw refuse(`--games must be a positive whole number, not "${value}".`);
  }
  return options;
}

const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places;
const rate = (wins, games) => (games === 0 ? 0 : round(wins / games, 3));
const record = (wins, losses, draws) => ({ wins, losses, draws, winRate: rate(wins, wins + losses + draws) });

/**
 * The numbers for finished games, each { aSide, winner (a side, or null for a draw), answers }. `tiers` is each
 * tier's record (when A and B are the same tier it holds that one name once, as A's record), `sides` each side's
 * record over all games, and `tierSides` each tier's games and wins by the side it sat on.
 */
export function tallyArena(a, b, results) {
  const sides = Object.fromEntries(SIDES.map((s) => [s, { wins: 0, losses: 0, draws: 0 }]));
  const tierSides = Object.fromEntries(
    [a, b].map((t) => [t, { lio: { games: 0, wins: 0 }, sae: { games: 0, wins: 0 } }]),
  );
  const tiers = { [a]: { wins: 0, losses: 0, draws: 0 }, [b]: { wins: 0, losses: 0, draws: 0 } };
  let answers = 0;
  let draws = 0;
  for (const { aSide, winner, answers: n } of results) {
    answers += n;
    if (winner === null) draws += 1;
    for (const side of SIDES) {
      sides[side][winner === null ? "draws" : winner === side ? "wins" : "losses"] += 1;
    }
    const bSide = aSide === "lio" ? "sae" : "lio";
    for (const [name, side] of a === b
      ? [[a, aSide]]
      : [
          [a, aSide],
          [b, bSide],
        ]) {
      const mine = tiers[name];
      mine[winner === null ? "draws" : winner === side ? "wins" : "losses"] += 1;
      tierSides[name][side].games += 1;
      if (winner === side) tierSides[name][side].wins += 1;
    }
  }
  const games = results.length;
  const withRate = ({ wins, losses, draws: d }) => record(wins, losses, d);
  return {
    games,
    draws,
    averageAnswers: games === 0 ? 0 : round(answers / games, 2),
    tiers: Object.fromEntries(Object.entries(tiers).map(([name, r]) => [name, withRate(r)])),
    sides: Object.fromEntries(Object.entries(sides).map(([name, r]) => [name, withRate(r)])),
    tierSides,
  };
}

const title = (tier) => tier[0].toUpperCase() + tier.slice(1);

/** The result of the Decision 8 gate for this pairing, { pass, line }, or null when no gate applies to it. */
export function checkGate(tally) {
  const gate = GATES.find(
    (g) => tally.tiers[g.strong] !== undefined && tally.tiers[g.weak] !== undefined && g.strong !== g.weak,
  );
  if (gate === undefined || tally.games === 0) return null;
  const share = tally.tiers[gate.strong].winRate;
  const pass = share > gate.over;
  const line =
    `Gate: ${title(gate.strong)} beats ${title(gate.weak)} in ${(share * 100).toFixed(1)}% of games ` +
    `(needs over ${gate.over * 100}%): ${pass ? "PASS" : "FAIL"}`;
  return { pass, line };
}

/**
 * Plays the arena. Game `i` has seed `${seed}-${i}`; the two tiers swap sides each game. `createPlayer` is not
 * offered: the arena plays the real tiers only.
 */
export function runArena({ a, b, games, seed, scenario = DEFAULT_SCENARIO }) {
  const config = balanceConfig({ scenario });
  const results = Array.from({ length: games }, (_, i) => {
    const aSide = sideOf("a", i);
    const tiers = { [aSide]: a, [aSide === "lio" ? "sae" : "lio"]: b };
    const { status, answers } = playBalanceGame(seed, i, structuredClone(config), { tiers });
    return { aSide, winner: status.winner, answers };
  });
  const tally = tallyArena(a, b, results);
  return { a, b, seed, scenario, results, tally, gate: checkGate(tally) };
}

const pct = (r) => `${(r.winRate * 100).toFixed(1)}%`;
const line = (name, r) => `  ${name}: ${r.wins} wins, ${r.losses} losses, ${r.draws} draws (${pct(r)} win rate)`;

/** The plain-text report. */
export function formatArena({ a, b, seed, scenario, tally, gate }) {
  const lines = [
    `Arena: ${a} vs ${b}, ${tally.games} games, ${scenario} scenario, base seed "${seed}"`,
    "",
    "By tier:",
  ];
  for (const name of new Set([a, b])) lines.push(line(name, tally.tiers[name]));
  lines.push("", "By side (all games):");
  for (const side of SIDES) lines.push(line(side.toUpperCase(), tally.sides[side]));
  lines.push("", "Each tier by the side it played:");
  for (const name of new Set([a, b])) {
    const bySide = SIDES.map((s) => {
      const { games, wins } = tally.tierSides[name][s];
      return `${s.toUpperCase()} ${wins}/${games}`;
    });
    lines.push(`  ${name}: ${bySide.join(", ")}`);
  }
  lines.push("", `Draws: ${tally.draws}. Average answers per game: ${tally.averageAnswers}.`);
  if (gate !== null) lines.push("", gate.line);
  return `${lines.join("\n")}\n`;
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
    const run = runArena(options);
    process.stdout.write(options.json ? `${JSON.stringify(run.tally, null, 2)}\n` : formatArena(run));
    if (run.gate !== null && !run.gate.pass) process.exitCode = 1;
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}
