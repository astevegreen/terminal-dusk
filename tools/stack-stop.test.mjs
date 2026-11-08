// stack-stop.mjs stops the computer's local Supabase stack at a sprint's end, keeping its data. None of these tests
// needs Docker: the run is a fake that answers as the Supabase CLI and stack-lock.mjs do.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stopEnv, stopStack, verdict } from "./stack-stop.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SECRET = /^v1,whsec_[A-Za-z0-9+/=]{32,}$/;

test("a throwaway hook secret is added when none is set, because the CLI won't read config.toml without one", () => {
  const env = stopEnv({ PATH: "x" });
  assert.match(env.SEND_EMAIL_HOOK_SECRET, SECRET);
  assert.equal(env.PATH, "x");
  assert.notEqual(stopEnv({}).SEND_EMAIL_HOOK_SECRET, env.SEND_EMAIL_HOOK_SECRET, "a fresh value each time");
});

test("a hook secret that is already set is left alone, and the input is not changed", () => {
  const given = { SEND_EMAIL_HOOK_SECRET: "v1,whsec_mine" };
  assert.equal(stopEnv(given).SEND_EMAIL_HOOK_SECRET, "v1,whsec_mine");
  const empty = {};
  stopEnv(empty);
  assert.deepEqual(empty, {});
});

test("the stop waits its turn behind stack tests, runs in packages/server, and never drops the data", () => {
  let seen;
  stopStack({
    env: {},
    run: (cmd, args, opts) => {
      seen = { cmd, args, opts };
      return { status: 0, stdout: "Stopped supabase local development setup.", stderr: "" };
    },
  });
  assert.equal(seen.cmd, process.execPath);
  assert.deepEqual(seen.args, [path.join(ROOT, "tools", "stack-lock.mjs"), "pnpm exec supabase stop"]);
  assert.equal(seen.opts.cwd, path.join(ROOT, "packages", "server"));
  assert.match(seen.opts.env.SEND_EMAIL_HOOK_SECRET, SECRET);
  assert.ok(!seen.args.join(" ").includes("--no-backup"));
});

test("a stop that worked says so and exits 0", () => {
  const v = verdict({
    code: 0,
    stdout: '{"project_id_filter":"terminal-dusk","backup":true,"message":"Stopped supabase local development setup."}',
    stderr: "",
  });
  assert.deepEqual(v, { exit: 0, line: "stack-stop: stopped the local Supabase stack (its data is kept)." });
});

test("Docker not running means the stack is already down: exit 0", () => {
  const outputs = [
    // Docker Desktop closed on Windows (Supabase CLI 2.122, 8 Nov).
    '{"_tag":"Error","error":{"code":"StopListError","message":"failed to list containers: failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the path is correct and if the daemon is running"}}',
    "Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?",
    "error during connect: this error may indicate that the docker daemon is not running",
  ];
  for (const stderr of outputs) {
    assert.deepEqual(verdict({ code: 1, stdout: "", stderr }), {
      exit: 0,
      line: "stack-stop: Docker isn't running, so the stack is already down.",
    });
  }
});

test("a lock wait that gave up exits 1 with stack-lock's own words", () => {
  const gaveUp =
    'stack-lock: gave up after 480 s waiting for the local Supabase stack, which C:/td-1 is using for "vitest run" ' +
    '(since x). "pnpm exec supabase stop" did not run; run it again once that has finished.';
  const stderr = `stack-lock: waiting for the local Supabase stack, which C:/td-1 is using for "vitest run" (since x).\n${gaveUp}\n`;
  assert.deepEqual(verdict({ code: 1, stdout: "", stderr }), { exit: 1, line: gaveUp });
});

test("any other failure exits 1 with the tool's last line", () => {
  const stderr = '{"_tag":"Error","error":{"code":"StopConfigLoadError","message":"Invalid hook config"}}\n';
  assert.deepEqual(verdict({ code: 1, stdout: "", stderr }), {
    exit: 1,
    line: `stack-stop: the stop failed: ${stderr.trim()}`,
  });
  assert.deepEqual(verdict({ code: 2, stdout: "", stderr: "" }), {
    exit: 1,
    line: "stack-stop: the stop failed with exit code 2.",
  });
});
