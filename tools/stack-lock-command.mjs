// How stack-lock.mjs runs its command: in a shell, as one group of programs that can be stopped together, so a
// stopped run never leaves part of its command on the stack after it has let the stack go.
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";

const WINDOWS = process.platform === "win32";

// The command is the package script's own text, never input from a player or the network. Outside Windows it gets
// its own process group, so a stop reaches everything it started.
export function startCommand(command, stdio = "inherit") {
  return spawn(command, { shell: true, stdio, windowsHide: true, detached: !WINDOWS }); // NOSONAR (javascript:S4721)
}

// Stops the command and everything it started. Stopping only the shell would leave the rest running.
export function stopCommand(child, signal = "SIGTERM") {
  if (WINDOWS) spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true });
  else {
    try {
      process.kill(-child.pid, signal);
    } catch {
      // already ended
    }
  }
}

// The run's exit code: the command's own, or 128 + the signal's number when a signal stopped it, as shells report it.
export const exitCode = (code, signal) => (code === null ? 128 + (os.constants.signals[signal] ?? 0) : code);
