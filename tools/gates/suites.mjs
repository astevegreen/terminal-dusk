// `pnpm fuzz`, `pnpm fuzz:quick`, `pnpm golden:check` and `pnpm golden:update`.
// Fuzz and golden-replay suites are Vitest files in tests/fuzz/ and tests/golden/ (see tests/README.md).
// fuzz: `--games N` reaches every suite as the FUZZ_GAMES environment variable.
// golden: `--update` re-records the saved replays (Vitest -u and GOLDEN_UPDATE=1); only for an intended
// rules change. Each run type-checks tests/ first. With no suites yet, it says so and passes.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const SUITE = /\.test\.tsx?$/;

export function parseArgs(argv) {
  const [kind, ...rest] = argv;
  if (kind !== "fuzz" && kind !== "golden") throw new Error("Usage: suites.mjs fuzz --games <n> | suites.mjs golden [--update]");
  const opts = { kind, games: null, update: false };
  for (let i = 0; i < rest.length; i++) {
    if (kind === "fuzz" && rest[i] === "--games") {
      const n = Number(rest[++i]);
      if (!Number.isInteger(n) || n < 1) throw new Error("--games needs a whole number of games, for example --games 1000");
      opts.games = n;
    } else if (kind === "golden" && rest[i] === "--update") {
      opts.update = true;
    } else {
      throw new Error(`Unknown option for ${kind}: ${rest[i]}`);
    }
  }
  if (kind === "fuzz" && opts.games === null) throw new Error("fuzz needs --games <n>");
  return opts;
}

export function findSuites(root, kind) {
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
      if (d.isDirectory()) return walk(path.join(dir, d.name));
      return SUITE.test(d.name) ? [path.join(dir, d.name)] : [];
    });
  const dir = path.join(root, "tests", kind);
  return existsSync(dir) ? walk(dir).map((f) => path.relative(root, f).replaceAll("\\", "/")).sort() : [];
}

// What a run does: a message when there is nothing to run, else the commands in order.
export function planRun(root, { kind, games, update }) {
  const suites = findSuites(root, kind);
  if (!suites.length) return { message: `No ${kind} suites in tests/${kind}/ yet, so there is nothing to run.`, steps: [] };
  const bin = (rel) => path.join(root, "node_modules", ...rel.split("/"));
  const env = kind === "fuzz" ? { FUZZ_GAMES: String(games) } : update ? { GOLDEN_UPDATE: "1" } : {};
  const vitestArgs = ["run", "--dir", `tests/${kind}`, ...(update ? ["-u"] : [])];
  return {
    message: null,
    steps: [
      { command: process.execPath, args: [bin("typescript/bin/tsc"), "-p", path.join(root, "tests", "tsconfig.json")], env: {} },
      { command: process.execPath, args: [bin("vitest/vitest.mjs"), ...vitestArgs], env },
    ],
  };
}

if (import.meta.main) {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
  const plan = planRun(ROOT, opts);
  if (plan.message) process.stdout.write(`${plan.message}\n`);
  for (const step of plan.steps) {
    const r = spawnSync(step.command, step.args, {
      cwd: ROOT, env: { ...process.env, ...step.env }, stdio: "inherit", windowsHide: true,
    });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
}
