// How gemini-api.mjs's postApi sends a request: from a child node, through HTTPS_PROXY as cloud sessions require.
// Split out of agy-api.test.mjs, which tests the rest of the Gemini API fallback.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { API, parseApiReply, postApi } from "./gemini-api.mjs";

// A proxy in its own process (postApi blocks this one) that refuses every tunnel and prints its port.
const REFUSING_PROXY =
  'const s = require("node:http").createServer();' +
  's.on("connect", (req, sock) => sock.end("HTTP/1.1 407 Proxy Authentication Required\\r\\n\\r\\n"));' +
  "s.listen(0, () => console.log(s.address().port));";

test("the child tunnels through HTTPS_PROXY, as cloud sessions require", async () => {
  const proxy = spawn(process.execPath, ["-e", REFUSING_PROXY], { stdio: ["ignore", "pipe", "inherit"] });
  const port = await new Promise((resolve) => proxy.stdout.once("data", (d) => resolve(String(d).trim())));
  const before = process.env.HTTPS_PROXY;
  try {
    process.env.HTTPS_PROXY = `http://127.0.0.1:${port}`;
    assert.deepEqual(postApi(`${API}/x:generateContent`, {}, "k"), {
      status: 0,
      text: "the proxy refused the tunnel (407)",
    });
  } finally {
    if (before === undefined) delete process.env.HTTPS_PROXY;
    else process.env.HTTPS_PROXY = before;
    proxy.kill();
  }
});

// A proxy that accepts the tunnel, then cuts it: after the first bytes through it (printing whether they open a TLS
// handshake for the API's host), or after a second if none come, as the cloud proxy cuts an idle tunnel.
const CUTTING_PROXY =
  'const s = require("node:http").createServer();' +
  's.on("connect", (req, sock) => {' +
  '  sock.write("HTTP/1.1 200 Connection Established\\r\\n\\r\\n");' +
  "  const cut = setTimeout(() => sock.resetAndDestroy(), 1000);" +
  '  sock.once("data", (d) => {' +
  "    clearTimeout(cut);" +
  '    console.log(d[0] === 22 && d.includes("gemini.invalid") ? "tls hello" : "other bytes");' +
  "    sock.resetAndDestroy();" +
  "  });" +
  "  sock.resume();" +
  "});" +
  "s.listen(0, () => console.log(s.address().port));";

test("the request travels inside the tunnel, and a cut tunnel comes back as a reason, not a crash", async () => {
  const proxy = spawn(process.execPath, ["-e", CUTTING_PROXY], { stdio: ["ignore", "pipe", "inherit"] });
  let said = "";
  proxy.stdout.setEncoding("utf8").on("data", (d) => (said += d));
  const port = await new Promise((resolve) => proxy.stdout.once("data", (d) => resolve(String(d).trim())));
  const before = process.env.HTTPS_PROXY;
  try {
    process.env.HTTPS_PROXY = `http://127.0.0.1:${port}`;
    // gemini.invalid has no address, so only the tunnel can carry this request anywhere.
    const r = postApi("https://gemini.invalid/v1beta/models/x:generateContent", {}, "k");
    assert.equal(r.status, 0);
    assert.doesNotMatch(r.text, /node:events|Unhandled/);
    assert.match(r.text, /ECONNRESET|socket hang up|disconnected/);
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.match(said, /tls hello/);
  } finally {
    if (before === undefined) delete process.env.HTTPS_PROXY;
    else process.env.HTTPS_PROXY = before;
    proxy.kill();
  }
});

test("a child that crashes is reported by its error line, not the first line of the stack", () => {
  const stderr = [
    "node:events:497",
    "      throw er; // Unhandled 'error' event",
    "      ^",
    "",
    "Error: read ECONNRESET",
    "    at TCP.onStreamRead (node:internal/stream_base_commons:216:20)",
  ].join("\n");
  const r = postApi(`${API}/x:generateContent`, {}, "k", () => ({ stdout: "", stderr }));
  assert.throws(
    () => parseApiReply(r),
    (err) => err.stop && /could not be reached \(no answer\): Error: read ECONNRESET$/.test(err.message),
  );
});

// A proxy that refuses the tunnel but leaves the connection open.
const LINGERING_PROXY =
  'const s = require("node:http").createServer();' +
  's.on("connect", (req, sock) => sock.write("HTTP/1.1 407 Proxy Authentication Required\\r\\n\\r\\n"));' +
  "s.listen(0, () => console.log(s.address().port));";

test("the child exits once it has answered, though the proxy leaves the connection open", async () => {
  const proxy = spawn(process.execPath, ["-e", LINGERING_PROXY], { stdio: ["ignore", "pipe", "inherit"] });
  const port = await new Promise((resolve) => proxy.stdout.once("data", (d) => resolve(String(d).trim())));
  const before = process.env.HTTPS_PROXY;
  // A 5-second limit in place of 11 minutes: a child that waits on the open connection is cut off and says so.
  const short = (cmd, args, opts) => spawnSync(cmd, args, { ...opts, timeout: 5000 });
  try {
    process.env.HTTPS_PROXY = `http://127.0.0.1:${port}`;
    assert.deepEqual(postApi(`${API}/x:generateContent`, {}, "k", short), {
      status: 0,
      text: "the proxy refused the tunnel (407)",
    });
  } finally {
    if (before === undefined) delete process.env.HTTPS_PROXY;
    else process.env.HTTPS_PROXY = before;
    proxy.kill();
  }
});

test("a request cut off by the time limit passes on", () => {
  const late = postApi(`${API}/x:generateContent`, {}, "k", () => ({ error: { code: "ETIMEDOUT" } }));
  assert.throws(
    () => parseApiReply(late),
    (err) => !err.stop && /ran out of time/.test(err.message),
  );
});
