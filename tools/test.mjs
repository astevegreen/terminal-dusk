// `pnpm test`: unit tests. `pnpm test --filter engine` (or -F, repeatable) runs only those packages;
// anything else on the command line goes to Vitest, e.g. `pnpm test --filter engine -t "draws a card"`.
// With no filter it runs every package's tests, then the tool tests (tools/**/*.test.mjs).
// A filter that matches no package is an error, so a typo can't pass silently.
import path from "node:path";
import { pnpmCommand, run } from "./lib/run.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

export function parseArgs(argv) {
  const filters = [];
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--filter" || a === "-F") {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a package name, for example: pnpm test --filter engine`);
      filters.push(argv[++i]);
    } else if (a.startsWith("--filter=")) {
      filters.push(a.slice("--filter=".length));
    } else {
      rest.push(a);
    }
  }
  return { filters, rest };
}

export function commandsFor({ filters, rest }, env = process.env) {
  if (filters.length) {
    const selectors = filters.flatMap((f) => ["--filter", f]);
    return [pnpmCommand([...selectors, "--fail-if-no-match", "run", "test", ...rest], env)];
  }
  return [
    pnpmCommand(["-r", "run", "test", ...rest], env),
    { command: process.execPath, args: ["--test", "tools/**/*.test.mjs"] },
  ];
}

if (import.meta.main) {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
  for (const command of commandsFor(parsed)) {
    const status = run(command, { cwd: ROOT });
    if (status !== 0) process.exit(status);
  }
}
