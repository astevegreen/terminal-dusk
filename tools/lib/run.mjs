// Helpers for the tool scripts: start pnpm and other commands the same way on Windows, macOS and Linux.
import { spawnSync } from "node:child_process";
import path from "node:path";

const quote = (a) => (/^[\w./:=@-]+$/.test(a) ? a : `"${a.replace(/"/g, '\\"')}"`);

// How to start pnpm: the pnpm that is running this script when there is one (`pnpm run` sets
// npm_execpath), else `pnpm` from PATH through the shell, which Windows needs for pnpm.cmd.
export function pnpmCommand(args, env = process.env) {
  const exec = env.npm_execpath;
  if (exec && /pnpm/i.test(path.basename(exec))) {
    return /\.[cm]?js$/.test(exec)
      ? { command: process.execPath, args: [exec, ...args], shell: false }
      : { command: exec, args, shell: false };
  }
  return { command: ["pnpm", ...args].map(quote).join(" "), args: [], shell: true };
}

// Runs a command with its output going straight to this terminal; returns the exit code.
export function run({ command, args = [], shell = false }, { cwd, env } = {}) {
  const r = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    shell,
    stdio: "inherit",
    windowsHide: true,
  });
  if (r.error) {
    process.stderr.write(`Could not start ${command}: ${r.error.message}\n`);
    return 1;
  }
  return r.status ?? 1;
}
