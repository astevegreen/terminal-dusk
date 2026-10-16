import { test } from "node:test";
import assert from "node:assert/strict";
import { pnpmCommand } from "./run.mjs";

test("uses the pnpm binary that started the script, without a shell", () => {
  const c = pnpmCommand(["run", "test"], { npm_execpath: "C:\\pnpm\\pnpm.exe" });
  assert.deepEqual(c, { command: "C:\\pnpm\\pnpm.exe", args: ["run", "test"], shell: false });
});

test("runs a JavaScript pnpm entry point with Node", () => {
  const c = pnpmCommand(["run", "test"], { npm_execpath: "/opt/pnpm/bin/pnpm.cjs" });
  assert.deepEqual(c, { command: process.execPath, args: ["/opt/pnpm/bin/pnpm.cjs", "run", "test"], shell: false });
});

test("falls back to pnpm on PATH through the shell, quoting arguments with spaces", () => {
  for (const env of [{}, { npm_execpath: "/usr/lib/node_modules/npm/bin/npm-cli.js" }]) {
    const c = pnpmCommand(["run", "test", "-t", 'draws a "card"'], env);
    assert.deepEqual(c, { command: 'pnpm run test -t "draws a \\"card\\""', args: [], shell: true });
  }
});
