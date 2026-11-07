// The Gemini API fallback in agy.mjs: used only where agy is not installed (a cloud session) and a key is set.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  API,
  ARGON,
  FLASH,
  OPUS,
  SONNET,
  askFirstAvailable,
  postApi,
  askModel,
  apiPrompt,
  buildPrompt,
  geminiApi,
  parseApiReply,
} from "./agy.mjs";

const NOW = Date.parse("2026-11-07T12:00:00Z");
const memory = () => ({ outUntil: () => null, markOut: () => {} });
const missing = () => ({ error: { code: "ENOENT" } });
const ok = (answer) => ({
  status: 200,
  text: JSON.stringify({
    candidates: [
      { content: { parts: [{ text: "thinking…", thought: true }, { text: answer }] }, finishReason: "STOP" },
    ],
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
const read = (file) => (file === material ? "diff --git a/x b/x\n+one line" : assert.fail(`read ${file}`));

test("the API prompt says nothing can be read, and carries the material's text in place of its path", () => {
  const text = apiPrompt(buildPrompt("Review this change.", material), read);
  assert.match(text, /^You are answering through the Gemini API: you cannot read files or run commands/);
  assert.doesNotMatch(text, /You are running headless|each file read takes/);
  assert.match(text, /Review this change\.\n\nThe material follows, in full\.\n\ndiff --git a\/x b\/x\n\+one line\n$/);
  assert.doesNotMatch(text, /The material is in/);
});

test("an audit with no material is refused on the API, which cannot read the repository", () => {
  assert.throws(() => apiPrompt(buildPrompt("Audit the repo."), read), /cannot read the repository/);
});

test("where agy is not installed and a key is set, the Gemini API answers with the same model", () => {
  const { post, sent } = posts(ok("No findings.\n"));
  const api = geminiApi("test-key", post, read);
  const answer = askModel(missing, buildPrompt("Review this.", material), FLASH, ["--add-dir", "C:/tmp"], api);
  assert.equal(answer, "No findings.");
  assert.match(sent[0].body.contents[0].parts[0].text, /\+one line\n$/);
  assert.equal(sent[0].url, `${API}/gemini-3.8-flash:generateContent`);
  assert.equal(sent[0].key, "test-key");
  assert.deepEqual(sent[0].body.generationConfig.thinkingConfig, { thinkingLevel: "high" });
});

test("with agy installed, the API is never asked, even with a key", () => {
  const run = () => ({ status: 0, stdout: JSON.stringify({ status: "SUCCESS", response: "From agy." }), stderr: "" });
  const api = () => assert.fail("the API was asked");
  assert.equal(askModel(run, "Review this.", FLASH, [], api), "From agy.");
});

test("with no key there is no API, and a missing agy says how to use one", () => {
  assert.equal(geminiApi(""), null);
  assert.throws(() => askModel(missing, "Review this.", FLASH, [], null), {
    message: "agy is not installed, and GEMINI_API_KEY is not set for the Gemini API",
  });
});

test("on the API a deep review passes over Claude's models to the Gemini ones", () => {
  // Argon is busy (a 429), Opus is not on the API and costs no request, Flash answers.
  const { post, sent } = posts(failed(429, "Resource has been exhausted (e.g. check quota)."), ok("Deep findings."));
  const api = geminiApi("test-key", post, read);
  const prompt = buildPrompt("Review this spec.", material);
  const ask = (model) => askModel(missing, prompt, model, [], api);
  const result = askFirstAvailable([ARGON, OPUS, FLASH, SONNET], ask, memory(), () => NOW);
  assert.equal(result.model, FLASH);
  assert.equal(result.response, "Deep findings.");
  assert.deepEqual(
    result.passed.map((p) => [p.model, p.why]),
    [
      [ARGON, "was too busy"],
      [OPUS, "is not on the Gemini API"],
    ],
  );
  assert.deepEqual(
    sent.map((s) => s.url),
    [`${API}/gemini-4-argon:generateContent`, `${API}/gemini-3.8-flash:generateContent`],
  );
});

test("a project with no credit stops the review instead of passing it on", () => {
  // What the API answered on 2026-11-07, when the key's project had no prepaid credit.
  const broke = posts(failed(402, "Your prepayment credits are depleted. Please go to AI Studio to manage billing."));
  const api = geminiApi("test-key", broke.post, read);
  const ask = (model) => askModel(missing, buildPrompt("Review this.", material), model, [], api);
  assert.throws(() => askFirstAvailable([FLASH, SONNET], ask, memory(), () => NOW), {
    message: /^Gemini 3\.8 Flash \(high\): the Gemini API project has no credit left: Your prepayment credits/,
  });
  assert.equal(broke.sent.length, 1);
});

test("a bad key, an unreachable API, a cut-off answer and an empty one are each reported", () => {
  assert.throws(() => parseApiReply(failed(400, "API key not valid.")), {
    message: "the Gemini API answered 400: API key not valid.",
  });
  assert.throws(() => parseApiReply({ status: 0, text: "getaddrinfo ENOTFOUND" }), {
    message: "the Gemini API could not be reached (no answer): getaddrinfo ENOTFOUND",
  });
  const cut = { candidates: [{ content: { parts: [{ text: "Half" }] }, finishReason: "MAX_TOKENS" }] };
  assert.throws(() => parseApiReply({ status: 200, text: JSON.stringify(cut) }), /ran out of room/);
  const blocked = { promptFeedback: { blockReason: "SAFETY" } };
  assert.throws(() => parseApiReply({ status: 200, text: JSON.stringify(blocked) }), {
    message: "the model gave no answer (Gemini API reason SAFETY)",
  });
});

test("a request runs in a child node and a refused connection comes back as a reason, not a crash", () => {
  const r = postApi("https://127.0.0.1:9/v1beta/models/x:generateContent", { contents: [] }, "test-key");
  assert.equal(r.status, 0);
  assert.match(r.text, /ECONNREFUSED/);
  assert.throws(
    () => parseApiReply(r),
    /^Error: the Gemini API could not be reached \(no answer\): connect ECONNREFUSED/,
  );
});
