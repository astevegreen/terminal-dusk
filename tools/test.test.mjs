import { test } from "node:test";
import assert from "node:assert/strict";
import { commandsFor, parseArgs } from "./test.mjs";

const env = { npm_execpath: "/bin/pnpm.exe" };

test("--filter, -F and --filter= pick packages; everything else goes to Vitest", () => {
  assert.deepEqual(parseArgs(["--filter", "engine", "-F", "host", "--filter=ai", "-t", "draws a card"]), {
    filters: ["engine", "host", "ai"],
    rest: ["-t", "draws a card"],
  });
});

test("--filter without a package name is an error", () => {
  assert.throws(() => parseArgs(["--filter"]), /needs a package name/);
});

test("with a filter, runs only those packages' tests and fails if a name matches nothing", () => {
  assert.deepEqual(commandsFor({ filters: ["engine"], rest: ["src/a.test.ts"] }, env), [
    {
      command: "/bin/pnpm.exe",
      args: ["--filter", "engine", "--fail-if-no-match", "run", "test", "src/a.test.ts"],
      shell: false,
    },
  ]);
});

test("without a filter, runs every package's tests and then the tool tests", () => {
  const [packages, tools] = commandsFor({ filters: [], rest: [] }, env);
  assert.deepEqual(packages, { command: "/bin/pnpm.exe", args: ["-r", "run", "test"], shell: false });
  assert.deepEqual(tools, { command: process.execPath, args: ["--test", "tools/**/*.test.mjs"] });
});
