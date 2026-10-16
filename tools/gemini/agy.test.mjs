import { test } from "node:test";
import assert from "node:assert/strict";
import { MODELS, TIMEOUT, askFirstAvailable, buildPrompt, parseReply } from "./agy.mjs";

// The message agy actually returned when the Argon quota ran out (2026-10-16).
const QUOTA =
  "Individual quota reached. Please upgrade your subscription to increase your limits. Resets in 151h45m8s.";

function fakeAgy(outcomes) {
  const asked = [];
  const ask = (model) => {
    asked.push(model);
    const outcome = outcomes[model];
    if (outcome instanceof Error) throw outcome;
    return outcome;
  };
  return { ask, asked };
}

const reply = (json, status = 0) => ({ status, stdout: JSON.stringify(json), stderr: "" });

test("Argon is asked first and Flash is only the fallback", () => {
  assert.deepEqual(MODELS, ["gemini-4-argon-high", "gemini-3.8-flash-high"]);
});

test("when the first model answers, the second is never asked", () => {
  const { ask, asked } = fakeAgy({ a: "looks fine", b: "unused" });
  assert.deepEqual(askFirstAvailable(["a", "b"], ask), { model: "a", response: "looks fine" });
  assert.deepEqual(asked, ["a"]);
});

test("when the first model is out of quota, the next one answers and is named", () => {
  const { ask, asked } = fakeAgy({ a: new Error(QUOTA), b: "two concerns" });
  assert.deepEqual(askFirstAvailable(["a", "b"], ask), { model: "b", response: "two concerns" });
  assert.deepEqual(asked, ["a", "b"]);
});

test("any other failure is reported as it is, without trying another model", () => {
  const { ask, asked } = fakeAgy({ a: new Error("agy is not installed"), b: "unused" });
  assert.throws(() => askFirstAvailable(["a", "b"], ask), /^Error: agy is not installed$/);
  assert.deepEqual(asked, ["a"]);
});

test("when every model is out of quota, the error names them all and keeps agy's message", () => {
  const { ask } = fakeAgy({ a: new Error(QUOTA), b: new Error(QUOTA) });
  assert.throws(
    () => askFirstAvailable(["a", "b"], ask),
    (err) => {
      assert.match(err.message, /every model is out of quota \(a, b\)/);
      assert.match(err.message, /Resets in 151h45m8s/);
      return true;
    },
  );
});

test("every prompt starts by telling Gemini which commands it can run", () => {
  const prompt = buildPrompt("Audit the repo.");
  assert.match(prompt, /^You are running headless/);
  assert.match(prompt, /git diff, git log, git show and git status/);
  assert.match(prompt, /blocked/);
  assert.match(prompt, /Audit the repo\.$/);
});

test("every prompt gives Gemini the time limit and a reading budget, so it answers before being cut off", () => {
  // On 2026-10-16 Flash read ~30 files at ~20 seconds each during one PR audit and ran out of time unanswered.
  const prompt = buildPrompt("Audit this pull request.");
  assert.equal(TIMEOUT, "10m");
  assert.match(prompt, /You have 10m in total/);
  assert.match(prompt, /at most 15 other files/);
  assert.match(prompt, /thrown away/);
});

test("when there is material, the prompt says where to read it", () => {
  assert.match(
    buildPrompt("Audit this spec.", "C:/tmp/material.md"),
    /Audit this spec\.\nThe material is in C:\/tmp\/material\.md\. Read all of it/,
  );
});

test("a successful reply gives back Gemini's answer, trimmed", () => {
  assert.equal(parseReply(reply({ status: "SUCCESS", response: "No findings.\n" })), "No findings.");
});

test("agy's own error, such as running out of quota, is passed on word for word", () => {
  assert.throws(() => parseReply(reply({ status: "ERROR", error: QUOTA })), { message: QUOTA });
});

test("an empty answer after a blocked command says so plainly", () => {
  // What agy returned when Flash tried a shell command during the weekly audit (2026-10-16).
  const r = reply({
    status: "SUCCESS",
    response: "",
    denied_actions: [{ action: "command", display_name: "RunCommand" }],
  });
  assert.throws(() => parseReply(r), {
    message: "Gemini gave no answer after trying something it is not allowed to do (RunCommand)",
  });
});

test("a run cut off by the time limit is reported as unfinished, even if it printed part of an answer", () => {
  // agy's note when the weekly audit on Flash ran past --print-timeout (2026-10-16).
  const stderr = "[agy] print timeout after 10m0s with turn in progress; returning partial output\n";
  for (const response of ["", "Partial notes so far"]) {
    const r = { status: 0, stdout: JSON.stringify({ status: "SUCCESS", response }), stderr };
    assert.throws(() => parseReply(r), { message: "Gemini ran out of time (10m0s) before finishing its answer" });
  }
});

test("an empty answer with no reason is still reported", () => {
  assert.throws(() => parseReply(reply({ status: "SUCCESS", response: "" })), {
    message: "Gemini gave no answer (agy status SUCCESS)",
  });
});

test("when agy is missing or prints something that is not JSON, the reason is reported", () => {
  assert.throws(() => parseReply({ error: { code: "ENOENT" } }), { message: "agy is not installed" });
  assert.throws(() => parseReply({ status: 1, stdout: "", stderr: "sign in first\nmore detail" }), {
    message: "agy exited 1: sign in first",
  });
});
