// The Gemini API fallback in agy.mjs: used only where agy is not installed (a cloud session) and a key is set.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  API,
  API_NOTE,
  ARGON,
  CONTEXT,
  FLASH,
  NO_API,
  apiFor,
  OPUS,
  SONNET,
  apiPrompt,
  askFirstAvailable,
  askModel,
  buildPrompt,
  geminiApi,
  parseApiReply,
  parseReply,
  postApi,
} from "./agy.mjs";

const NOW = Date.parse("2026-11-07T12:00:00Z");
const memory = () => ({ outUntil: () => null, markOut: () => {} });
const missing = () => ({ error: { code: "ENOENT" } });
const ok = (answer, finishReason = "STOP") => ({
  status: 200,
  text: JSON.stringify({
    candidates: [{ content: { parts: [{ text: "thinking…", thought: true }, { text: answer }] }, finishReason }],
  }),
});
const failed = (status, message) => ({ status, text: JSON.stringify({ error: { code: status, message } }) });

// A fake post that records each request and answers from a list.
function posts(...replies) {
  const sent = [];
  const post = (url, body, key) => {
    sent.push({ url, body, key });
    return replies[sent.length - 1];
  };
  return { post, sent };
}

const material = "C:/tmp/gemini-audit-x/material.md";
const DIFF = "diff --git a/x b/x\n+one line";
// Reads the material, and any rules file as a stand-in that names the findings format.
const reader =
  (text = DIFF) =>
  (file) =>
    file === material ? text : `Start each finding with [blocker] or [note]. (${path.basename(file)})`;
const read = reader();
const textOf = (sent) => sent.body.contents[0].parts[0].text;
const viaApi = (post, prompt) => (model) => askModel(missing, prompt, model, [], geminiApi("k", post, read, []));

test("the API prompt carries the repo's rules, the task and the material's text, and says nothing can be read", () => {
  const text = apiPrompt(buildPrompt("Review this change.", material), read, ["GEMINI.md"]);
  assert.match(text, /^# The repository's rules\n\n## GEMINI\.md\n\nStart each finding with \[blocker\] or \[note\]/);
  assert.match(text, /# The task\n\nYou are answering through the Gemini API: you cannot read files or run commands/);
  assert.doesNotMatch(text, /You are running headless|each file read takes|The material is in/);
  assert.match(text, /is never passed: report it, naming the file, as a blocking finding/);
  assert.match(text, /Review this change\.\n\n# The material, in full\n\ndiff --git a\/x b\/x\n\+one line\n$/);
});

test("the rules the API is given are the ones agy reads by itself, and they exist", () => {
  assert.deepEqual(CONTEXT, ["GEMINI.md", "CLAUDE.md", ".claude/rules/", "docs/architecture.md"]);
  for (const file of CONTEXT) assert.ok(existsSync(path.join(import.meta.dirname, "..", "..", file)), file);
});

test("the API refuses an audit with no material, a truncated diff, and a whole-repo audit", () => {
  assert.throws(() => apiPrompt(buildPrompt("Audit the repo."), read, []), /cannot read the repository/);
  const cut = reader(`${DIFF}\n... (diff truncated; read the rest from disk)\n`);
  assert.throws(() => apiPrompt(buildPrompt("Review this.", material), cut, []), /truncated diff/);
  const ask = (model) => askModel(missing, buildPrompt("Tour the code.", material), model, [], NO_API);
  assert.throws(() => askFirstAvailable([ARGON, FLASH], ask, memory(), () => NOW), {
    message: "Gemini 4 Argon (high): the Gemini API cannot read the repository, which this audit reads",
  });
});

test("where agy is not installed and a key is set, the same model answers, and the answer says how", () => {
  const { post, sent } = posts(ok("No findings.\n"));
  const api = geminiApi("test-key", post, read, []);
  const answer = askModel(missing, buildPrompt("Review this.", material), FLASH, ["--add-dir", "C:/tmp"], api);
  assert.equal(answer, `No findings.\n\n${API_NOTE}`);
  assert.equal(sent[0].url, `${API}/gemini-3.8-flash:generateContent`);
  assert.equal(sent[0].key, "test-key");
  assert.deepEqual(sent[0].body.generationConfig.thinkingConfig, { thinkingLevel: "high" });
  assert.match(textOf(sent[0]), /\+one line\n$/);
});

test("with agy installed, the API is never asked, even with a key", () => {
  const run = () => ({ status: 0, stdout: JSON.stringify({ status: "SUCCESS", response: "From agy." }), stderr: "" });
  assert.equal(askModel(run, "Review this.", FLASH, [], NO_API), "From agy.");
});

test("with no key there is no API, and a missing agy says how to use one", () => {
  assert.equal(geminiApi(""), null);
  assert.throws(() => askModel(missing, "Review this.", FLASH, [], null), {
    message: "agy is not installed, and GEMINI_API_KEY is not set for the Gemini API",
  });
  assert.throws(() => parseReply({ error: { code: "ENOENT" } }), /GEMINI_API_KEY is not set/);
});

test("a busy model, and a 5xx, even as a page, pass the review on; Claude's models cost no request", () => {
  const { post, sent } = posts(failed(429, "Resource has been exhausted (e.g. check quota)."), {
    status: 503,
    text: "<html>Service Unavailable</html>",
  });
  const ask = viaApi(post, buildPrompt("Review this spec.", material));
  assert.throws(() => askFirstAvailable([ARGON, OPUS, FLASH, SONNET], ask, memory(), () => NOW), {
    message:
      "no model answered: Gemini 4 Argon (high) was too busy; Claude Opus 5.5 (high) is not on the Gemini API; " +
      "Gemini 3.8 Flash (high) was too busy; Claude Sonnet 5.5 (high) is not on the Gemini API",
  });
  assert.equal(sent.length, 2);
  assert.throws(() => parseApiReply(failed(503, "The model is overloaded.")), /overloaded \(503\)/);
});

test("on the API a deep review passes a busy Argon and Opus over to Flash", () => {
  const { post } = posts(failed(429, "Too many requests."), ok("Deep findings."));
  const result = askFirstAvailable(
    [ARGON, OPUS, FLASH, SONNET],
    viaApi(post, buildPrompt("Review this spec.", material)),
    memory(),
    () => NOW,
  );
  assert.equal(result.model, FLASH);
  assert.equal(result.response, `Deep findings.\n\n${API_NOTE}`);
  assert.deepEqual(
    result.passed.map((p) => [p.model, p.why]),
    [
      [ARGON, "was too busy"],
      [OPUS, "is not on the Gemini API"],
    ],
  );
});

test("no credit, a bad key or a forbidden project stops the review, whatever Google's words say", () => {
  // The 402 is what the API answered on 2026-11-07, when the key's project had no prepaid credit.
  const replies = [
    [failed(402, "Your prepayment credits are depleted. Please go to AI Studio to manage billing."), /no credit left/],
    [failed(400, "API key not valid."), /refused the request \(400\): API key not valid/],
    [failed(403, "Quota project lacks capacity permission."), /refused the request \(403\)/],
  ];
  for (const [reply, message] of replies) {
    const { post, sent } = posts(reply);
    const ask = viaApi(post, buildPrompt("Review this.", material));
    assert.throws(
      () => askFirstAvailable([FLASH, ARGON], ask, memory(), () => NOW),
      (err) => /^Gemini 3\.8 Flash \(high\): /.test(err.message) && message.test(err.message),
    );
    assert.equal(sent.length, 1);
  }
});

test("only a finished reply is an answer: a cut-off, blocked or empty one is reported, never returned", () => {
  for (const reason of ["SAFETY", "RECITATION", "OTHER", "BLOCKLIST"])
    assert.throws(() => parseApiReply(ok("[note] half a review", reason)), {
      message: `the model gave no finished answer (Gemini API reason ${reason})`,
    });
  assert.throws(() => parseApiReply(ok("Half", "MAX_TOKENS")), /ran out of room/);
  const blocked = { promptFeedback: { blockReason: "SAFETY" } };
  assert.throws(() => parseApiReply({ status: 200, text: JSON.stringify(blocked) }), /reason SAFETY/);
  assert.throws(() => parseApiReply(ok("  ")), /gave no answer/);
  assert.equal(parseApiReply(ok("Fine.")), "Fine.");
});

test("an unreachable API stops the review; a request that ran out of time passes it on", () => {
  assert.throws(() => parseApiReply({ status: 0, text: "getaddrinfo ENOTFOUND" }), {
    message: "the Gemini API could not be reached (no answer): getaddrinfo ENOTFOUND",
  });
  const late = () => parseApiReply({ status: 0, text: "the model ran out of time before finishing its answer" });
  assert.throws(late, (err) => !err.stop && /ran out of time/.test(err.message));
});

test("the key reaches the child node in its environment, never on its command line", () => {
  let seen;
  const spawn = (cmd, args, opts) => {
    seen = { cmd, args, opts };
    return { stdout: JSON.stringify({ status: 200, text: "{}" }) };
  };
  postApi(`${API}/x:generateContent`, { contents: [] }, "secret-key", spawn);
  assert.equal(seen.cmd, process.execPath);
  assert.ok(!JSON.stringify(seen.args).includes("secret-key"));
  assert.ok(!seen.opts.input.includes("secret-key"));
  assert.equal(seen.opts.env.GEMINI_API_KEY, "secret-key");
});

test("a request runs in a child node and a refused connection comes back as a reason, not a crash", () => {
  const r = postApi("https://127.0.0.1:9/v1beta/models/x:generateContent", { contents: [] }, "test-key");
  assert.equal(r.status, 0);
  assert.match(r.text, /ECONNREFUSED/);
});

test("a rules folder in the context stands for its .md files, in name order", () => {
  const list = (dir) => (dir === ".claude/rules/" ? ["b.md", "notes.txt", "a.md"] : assert.fail(dir));
  const text = apiPrompt(buildPrompt("Review this.", material), read, ["GEMINI.md", ".claude/rules/"], list);
  assert.deepEqual(
    [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]),
    ["GEMINI.md", ".claude/rules/a.md", ".claude/rules/b.md"],
  );
});

test("the cut-off marker counts only on a line of its own, not quoted inside a diff line", () => {
  const quoted = reader(`${DIFF}\n+const TRUNCATED = "... (diff truncated; read the rest from disk)";\n`);
  assert.match(apiPrompt(buildPrompt("Review this.", material), quoted, []), /\+const TRUNCATED/);
});

test("a 5xx page that is not JSON passes on; a wrong model id (404) stops", () => {
  const page = () => parseApiReply({ status: 503, text: "<html>Service Unavailable</html>" });
  assert.throws(page, (err) => !err.stop && /overloaded \(503\)/.test(err.message));
  const wrong = () => parseApiReply(failed(404, "models/gemini-4-argon is not found"));
  assert.throws(wrong, (err) => err.stop && /no model by that id \(404\)/.test(err.message));
});

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

test("a request cut off by the time limit passes on", () => {
  const late = postApi(`${API}/x:generateContent`, {}, "k", () => ({ error: { code: "ETIMEDOUT" } }));
  assert.throws(
    () => parseApiReply(late),
    (err) => !err.stop && /ran out of time/.test(err.message),
  );
});

test("by default askModel uses the API exactly when GEMINI_API_KEY is set", () => {
  const before = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    assert.throws(() => askModel(missing, buildPrompt("Audit the repo."), FLASH), /agy is not installed/);
    process.env.GEMINI_API_KEY = "test-key";
    // No material, so the API refuses before any request: proof the default reached it.
    assert.throws(
      () => askModel(missing, buildPrompt("Audit the repo."), FLASH),
      /Gemini API cannot read the repository/,
    );
  } finally {
    if (before === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = before;
  }
});

test("whole-repo and spec audits are refused on the API, and the audit script asks apiFor by kind", () => {
  assert.equal(apiFor("repo"), NO_API);
  assert.equal(apiFor("spec"), NO_API);
  assert.equal(apiFor("change"), undefined);
  const script = readFileSync(path.join(import.meta.dirname, "../gemini-audit.mjs"), "utf8");
  assert.match(script, /apiFor\(what\.kind\)/);
});

test("an error inside a 200 reply is sorted by its own code", () => {
  const busy = { status: 200, text: JSON.stringify({ error: { code: 503, message: "The model is overloaded." } }) };
  assert.throws(
    () => parseApiReply(busy),
    (err) => !err.stop && /overloaded \(503\)/.test(err.message),
  );
});
