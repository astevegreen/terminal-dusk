// Stops the computer's local Supabase stack and keeps its data. The sprint archiver runs it once the window is over
// and no sprint session is left (docs/sprint.md, Machinery); anyone may run it after starting the stack by hand.
//   node tools/stack-stop.mjs
// The stack's containers restart with Docker, and Docker Desktop starts at sign-in, so a stack nobody stops runs
// for ever. The stop waits its turn behind stack tests (tools/stack-lock.mjs), so it never pulls the stack from
// under one. It prints one line. Exit 0: stopped, or Docker isn't running (so neither is the stack). Exit 1:
// the lock wait gave up, or the stop failed.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DOCKER_DOWN = /failed to connect to the docker API|Cannot connect to the Docker daemon|error during connect/i;

// config.toml reads the sign-in hook's secret from the environment, and the CLI refuses to load it, even to stop,
// without one. A stop never calls the hook, so any well-formed value does; a set one is left alone.
export function stopEnv(env) {
  if (env.SEND_EMAIL_HOOK_SECRET) return { ...env };
  return { ...env, SEND_EMAIL_HOOK_SECRET: `v1,whsec_${randomBytes(32).toString("base64")}` };
}

// Plain `supabase stop` keeps the database's volume; `--no-backup` would drop it, so it is never passed.
export function stopStack({ env = process.env, run = spawnSync } = {}) {
  const result = run(process.execPath, [path.join(ROOT, "tools", "stack-lock.mjs"), "pnpm exec supabase stop"], {
    cwd: path.join(ROOT, "packages", "server"),
    env: stopEnv(env),
    encoding: "utf8",
    windowsHide: true,
  });
  return verdict({ code: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" });
}

/** The run's one line and exit code, from its exit code and output. */
export function verdict({ code, stdout, stderr }) {
  if (code === 0) return { exit: 0, line: "stack-stop: stopped the local Supabase stack (its data is kept)." };
  const output = `${stdout}\n${stderr}`;
  if (DOCKER_DOWN.test(output))
    return { exit: 0, line: "stack-stop: Docker isn't running, so the stack is already down." };
  const last = output
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .at(-1);
  if (last?.startsWith("stack-lock:")) return { exit: 1, line: last };
  return {
    exit: 1,
    line: last ? `stack-stop: the stop failed: ${last}` : `stack-stop: the stop failed with exit code ${code}.`,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { exit, line } = stopStack();
  (exit === 0 ? console.log : console.error)(line);
  process.exitCode = exit;
}
