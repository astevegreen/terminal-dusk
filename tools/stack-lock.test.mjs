// stack-lock.mjs lets one folder at a time use the computer's local Supabase stack.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exitCode, startCommand, stopCommand } from "./stack-lock-command.mjs";

const TOOL = fileURLToPath(new URL("./stack-lock.mjs", import.meta.url));
const dir = mkdtempSync(path.join(os.tmpdir(), "td-stack-lock-"));
const script = (name, body) => {
  const file = path.join(dir, name);
  writeFileSync(file, body);
  return `node "${file}"`;
};
// `<step> <log> <name> <ms>` writes its process id beside the log and "<name> start", waits, then writes "<name> end".
const step = script(
  "step.mjs",
  `import { appendFileSync, writeFileSync } from "node:fs";
const [log, name, ms] = process.argv.slice(2);
writeFileSync(log + "." + name + ".pid", String(process.pid));
appendFileSync(log, name + " start\\n");
setTimeout(() => appendFileSync(log, name + " end\\n"), Number(ms));`,
);
const exitWith = script("exit.mjs", "process.exit(Number(process.argv[2]));");

const listen = (port, onConnection = () => {}) =>
  new Promise((resolve, reject) => {
    const server = net.createServer(onConnection);
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
const close = (server) => new Promise((resolve) => server.close(resolve));
const freePort = async () => {
  const server = await listen(0);
  const { port } = server.address();
  await close(server);
  return port;
};
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
};
const until = async (ok) => {
  for (let i = 0; i < 400 && !ok(); i++) await new Promise((r) => setTimeout(r, 25));
};

let n = 0;
async function fresh() {
  n++;
  const port = await freePort();
  const log = path.join(dir, `log-${n}.txt`);
  const env = { ...process.env, STACK_LOCK_PORT: String(port), STACK_LOCK_WAIT_MS: "20000" };
  const start = (command, more = {}) => {
    const proc = spawn(process.execPath, [TOOL, command], {
      cwd: dir,
      env: { ...env, ...more },
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d));
    const done = new Promise((resolve) => proc.on("exit", (status) => resolve({ status, stderr })));
    return { proc, done };
  };
  const runSync = (command, more = {}) =>
    spawnSync(process.execPath, [TOOL, command], {
      cwd: dir,
      env: { ...env, ...more },
      encoding: "utf8",
      windowsHide: true,
    });
  const lines = () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : []);
  const pidOf = (name) => Number(readFileSync(`${log}.${name}.pid`, "utf8"));
  return {
    port,
    start,
    run: (command) => start(command).done,
    runSync,
    lines,
    pidOf,
    step: (name, ms) => `${step} "${log}" ${name} ${ms}`,
  };
}

test("runs the command, passes its exit code through, and lets the stack go", async () => {
  const t = await fresh();
  assert.equal(t.runSync(`${exitWith} 3`).status, 3);
  assert.equal(t.runSync(`${exitWith} 0`).status, 0);
  await close(await listen(t.port));
});

test("a second run waits until the first has finished, and says which folder holds the stack and for what", async () => {
  const t = await fresh();
  const first = t.run(t.step("A", 1500));
  await until(() => t.lines().includes("A start"));
  const second = await t.run(t.step("B", 0));
  assert.equal((await first).status, 0);
  assert.equal(second.status, 0);
  assert.deepEqual(t.lines(), ["A start", "A end", "B start", "B end"]);
  assert.match(second.stderr, /waiting for the local Supabase stack, which .* is using for "node .* A 1500"/);
  assert.ok(second.stderr.includes(path.basename(dir)), second.stderr);
});

test("five runs started at the same moment take turns: never two at once", async () => {
  const t = await fresh();
  const names = ["A", "B", "C", "D", "E"];
  const results = await Promise.all(names.map((name) => t.run(t.step(name, 300))));
  assert.deepEqual(
    results.map((r) => r.status),
    [0, 0, 0, 0, 0],
  );
  const lines = t.lines();
  assert.equal(lines.length, 10);
  for (let i = 0; i < 10; i += 2) {
    const [name, what] = lines[i].split(" ");
    assert.deepEqual([what, lines[i + 1]], ["start", `${name} end`], lines.join(", "));
  }
});

test("a run that crashes lets the stack go at once, with no lock left behind", async () => {
  const t = await fresh();
  const first = t.start(t.step("A", 4000));
  await until(() => t.lines().includes("A start"));
  first.proc.kill("SIGKILL");
  await first.done;
  try {
    const second = await t.run(t.step("B", 0));
    assert.equal(second.status, 0);
    // B ran without waiting for A's command (which the crash left running) to end.
    assert.deepEqual(t.lines(), ["A start", "B start", "B end"]);
  } finally {
    if (alive(t.pidOf("A"))) process.kill(t.pidOf("A"));
  }
});

// A run stops its command this way when it is stopped (Ctrl+C, or a signal outside Windows).
test("stopping a run's command stops everything the command started, not only its shell", async () => {
  const t = await fresh();
  const child = startCommand(t.step("A", 5000), "ignore");
  try {
    await until(() => t.lines().includes("A start"));
    stopCommand(child, "SIGTERM");
    await until(() => !alive(t.pidOf("A")));
    assert.equal(alive(t.pidOf("A")), false);
    assert.deepEqual(t.lines(), ["A start"]);
  } finally {
    if (alive(t.pidOf("A"))) process.kill(t.pidOf("A"));
  }
});

test("a run passes on its command's exit code, or 128 + the signal's number when a signal stopped it", () => {
  assert.equal(exitCode(0, null), 0);
  assert.equal(exitCode(3, null), 3);
  assert.equal(exitCode(null, "SIGINT"), 130);
  assert.equal(exitCode(null, "SIGTERM"), 128 + os.constants.signals.SIGTERM);
});

test("gives up after the wait limit, names who holds the stack, and doesn't run the command", async () => {
  const t = await fresh();
  const first = t.run(t.step("A", 3000));
  await until(() => t.lines().includes("A start"));
  const r = await t.start(t.step("B", 0), { STACK_LOCK_WAIT_MS: "600" }).done;
  assert.equal(r.status, 1);
  assert.match(
    r.stderr,
    /gave up after 1 s waiting for the local Supabase stack, which .* is using for "node .* A 3000"/,
  );
  assert.match(r.stderr, /B 0" did not run/);
  assert.equal((await first).status, 0);
  assert.deepEqual(t.lines(), ["A start", "A end"]);
});

test("another program on the lock's port is reported, and nothing runs", async () => {
  const t = await fresh();
  for (const answer of [null, "HTTP/1.1 400 Bad Request\r\n\r\n"]) {
    const sockets = [];
    const other = await listen(t.port, (socket) => {
      sockets.push(socket);
      socket.on("error", () => {});
      if (answer) socket.end(answer);
    });
    try {
      const r = await t.run(t.step("B", 0));
      assert.equal(r.status, 1);
      assert.match(r.stderr, new RegExp(`another program is listening on 127\\.0\\.0\\.1:${t.port}`));
      assert.deepEqual(t.lines(), []);
    } finally {
      for (const socket of sockets) socket.destroy();
      await close(other);
    }
  }
});

test("with no command it says how to use it and runs nothing", () => {
  const r = spawnSync(process.execPath, [TOOL], { encoding: "utf8", windowsHide: true });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /usage/i);
});
