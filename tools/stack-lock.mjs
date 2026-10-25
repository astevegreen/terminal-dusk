// Runs a command while holding the computer's one local Supabase stack, so two folders never use it at once:
// a `supabase db reset` from one would empty the database under the other's stack tests (docs/sprint.md, online).
//   node tools/stack-lock.mjs <command…>   wait for the stack (up to 8 minutes), run the command, let the stack go
// The lock is a listening socket on 127.0.0.1, port 47853. The system lets only one program listen on a port and
// frees it the moment that program ends, even in a crash, so a lock is never left behind and never needs taking over.
// A waiter connects to it and is told which folder holds the stack, and for what.
// Exit codes: the command's own (128 + the signal's number when a signal stopped it), or 1 when no command was given,
// the stack stayed busy or the port couldn't be used (nothing ran then).
// STACK_LOCK_PORT and STACK_LOCK_WAIT_MS change the port and the wait (the tests use them).
import net from "node:net";
import { exitCode, startCommand, stopCommand } from "./stack-lock-command.mjs";

const HOST = "127.0.0.1";
const PORT = Number(process.env.STACK_LOCK_PORT) || 47853;
const WAIT_MS = Number(process.env.STACK_LOCK_WAIT_MS) || 8 * 60_000;
const POLL_MS = 250;
const ANSWER_MS = 1000;
const MARK = "terminal-dusk-stack-lock";
const WINDOWS = process.platform === "win32";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Listens on the lock's port, answering each connection with who holds the stack. Resolves to the server, or to the
// error code: EADDRINUSE when someone holds the port, EACCES when the system keeps it back (Windows reserves ranges).
function take(me) {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      socket.on("error", () => {});
      // The waiter closes the connection, so the port never lingers in TIME_WAIT once the holder ends.
      socket.write(`${JSON.stringify({ mark: MARK, ...me })}\n`);
    });
    server.once("error", (e) => resolve(e.code ?? String(e)));
    server.listen(PORT, HOST, () => resolve(server));
  });
}

// Who holds the stack, as its holder says: { folder, command, started }; null when nobody answers (it has just let
// go); "foreign" when some other program is listening on the port.
function holder() {
  return new Promise((resolve) => {
    let text = "";
    const socket = net.connect(PORT, HOST);
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    const read = () => {
      try {
        const said = JSON.parse(text);
        return said?.mark === MARK ? said : "foreign";
      } catch {
        return "foreign";
      }
    };
    socket.setEncoding("utf8");
    socket.setTimeout(ANSWER_MS, () => done("foreign"));
    socket.on("data", (d) => {
      text += d;
      if (text.includes("\n") || text.length > 4096) done(read());
    });
    socket.on("end", () => done(read()));
    socket.on("error", () => done(null));
  });
}

const describe = (h) => (h ? `${h.folder} is using for "${h.command}" (since ${h.started})` : "another run is using");
const fail = (message) => {
  console.error(`stack-lock: ${message}`);
  process.exit(1);
};

const command = process.argv.slice(2).join(" ").trim();
if (!command)
  fail("usage: node tools/stack-lock.mjs <command…>  (runs the command while holding the local Supabase stack)");
const notRun = `"${command}" did not run`;
const where = `127.0.0.1:${PORT}, the port that marks who holds the local Supabase stack`;

const me = { folder: process.cwd(), command, started: new Date().toISOString() };
const since = Date.now();
let told = false;
for (;;) {
  const got = await take(me);
  if (typeof got !== "string") break;
  if (got !== "EADDRINUSE")
    fail(
      `can't listen on ${where} (${got}). ${notRun}. Free that port, or set STACK_LOCK_PORT to another one everywhere.`,
    );
  const h = await holder();
  if (h === "foreign")
    fail(
      `another program is listening on ${where}. ${notRun}. Stop it, or set STACK_LOCK_PORT to another port everywhere.`,
    );
  if (Date.now() - since >= WAIT_MS)
    fail(
      `gave up after ${Math.round(WAIT_MS / 1000)} s waiting for the local Supabase stack, which ${describe(h)}. ` +
        `${notRun}; run it again once that has finished.`,
    );
  if (!told && h) console.error(`stack-lock: waiting for the local Supabase stack, which ${describe(h)}.`);
  told ||= Boolean(h);
  await sleep(POLL_MS);
}

const child = startCommand(command);
let stoppedBy = null;
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", ...(WINDOWS ? ["SIGBREAK"] : [])])
  process.on(signal, () => {
    stoppedBy ??= signal;
    stopCommand(child, signal);
  });
child.on("error", (e) => fail(`couldn't start "${command}": ${e.message}`));
child.on("exit", (code, signal) => process.exit(exitCode(code, signal ?? stoppedBy)));
