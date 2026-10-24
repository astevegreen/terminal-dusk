import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ARGON,
  DEEP_PATHS,
  FLASH,
  OPUS,
  ORDER,
  SONNET,
  TIMEOUT,
  askFirstAvailable,
  buildPrompt,
  byLine,
  diffStats,
  modelName,
  parseReply,
  pickDepth,
  quotaFile,
  resetsAt,
} from "./agy.mjs";

// The message agy actually returned when the Argon quota ran out (2026-10-16).
const QUOTA =
  "Individual quota reached. Please upgrade your subscription to increase your limits. Resets in 151h45m8s.";
const NOW = Date.parse("2026-10-24T12:00:00Z");
const HOUR = 3_600_000;

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

// A quota memory held in a plain object, so no test touches the real file.
function memory(out = {}) {
  return {
    out,
    outUntil: (model, now) => (out[model] > now ? new Date(out[model]) : null),
    markOut: (model, until) => {
      out[model] = until.getTime();
    },
  };
}

const ask = (models, outcomes, store = memory()) => {
  const agy = fakeAgy(outcomes);
  return { result: askFirstAvailable(models, agy.ask, store, () => NOW), asked: agy.asked, store };
};

const reply = (json, status = 0) => ({ status, stdout: JSON.stringify(json), stderr: "" });

test("every model runs at high effort", () => {
  for (const model of [ARGON, OPUS, FLASH, SONNET]) assert.match(model, /-high$/);
  assert.equal(modelName(ARGON), "Gemini 4 Argon (high)");
  assert.equal(modelName(SONNET), "Claude Sonnet 5.5 (high)");
});

test("a deep review spends Argon first; a standard review starts on Flash and never spends Argon", () => {
  assert.deepEqual(ORDER.deep, [ARGON, OPUS, FLASH, SONNET]);
  assert.deepEqual(ORDER.standard, [FLASH, SONNET, OPUS]);
});

test("specs get a deep review and whole-repo audits a standard one", () => {
  assert.equal(pickDepth({ kind: "spec" }).depth, "deep");
  assert.equal(pickDepth({ kind: "repo" }).depth, "standard");
});

test("a change touching a high-risk path gets a deep review, and the reason names the file", () => {
  const pick = pickDepth({ kind: "change", files: ["README.md", "packages/engine/src/apply.ts"], lines: 4 }, [
    "packages/engine/",
  ]);
  assert.deepEqual(pick, { depth: "deep", why: "it touches packages/engine/src/apply.ts" });
});

test("a small change to a file under each high-risk path the workflow names gets a deep review", () => {
  const named = {
    "packages/engine/": "packages/engine/src/apply.ts",
    "packages/host/": "packages/host/src/MatchHost.ts",
    "packages/server/": "packages/server/src/submit.ts",
    "docs/architecture.md": "docs/architecture.md",
    "tools/gates/": "tools/gates/boundary.mjs",
    "tools/hooks/": "tools/hooks/quick-check.mjs",
  };
  assert.deepEqual([...DEEP_PATHS].sort(), Object.keys(named).sort());
  for (const file of Object.values(named))
    assert.deepEqual(pickDepth({ kind: "change", files: [file], lines: 1 }), {
      depth: "deep",
      why: `it touches ${file}`,
    });
  assert.equal(pickDepth({ kind: "change", files: ["packages/app/src/App.tsx"], lines: 1 }).depth, "standard");
});

test("a large change gets a deep review anywhere; a small one elsewhere gets a standard review", () => {
  assert.deepEqual(pickDepth({ kind: "change", files: ["docs/a.md"], lines: 301 }, ["packages/engine/"]), {
    depth: "deep",
    why: "it changes 301 lines",
  });
  assert.equal(pickDepth({ kind: "change", files: ["docs/a.md"], lines: 300 }, ["packages/engine/"]).depth, "standard");
});

test("a diff's stats are its files and its added and removed lines, not its headers", () => {
  const diff = [
    "diff --git a/packages/engine/src/a.ts b/packages/engine/src/a.ts",
    "--- a/packages/engine/src/a.ts",
    "+++ b/packages/engine/src/a.ts",
    "@@ -1,2 +1,2 @@",
    "-old",
    "+new",
    " same",
    "diff --git a/docs/new.md b/docs/new.md",
    "new file mode 100644",
    "--- /dev/null",
    "+++ b/docs/new.md",
    "+one",
    "",
  ].join("\n");
  assert.deepEqual(diffStats(diff), { files: ["packages/engine/src/a.ts", "docs/new.md"], lines: 3 });
});

test("when the first model answers, the next is never asked", () => {
  const { result, asked } = ask(["a", "b"], { a: "looks fine", b: "unused" });
  assert.deepEqual(result, { model: "a", response: "looks fine", passed: [] });
  assert.deepEqual(asked, ["a"]);
});

test("a model out of quota passes to the next, and is remembered until agy says it resets", () => {
  const { result, asked, store } = ask(["a", "b"], { a: new Error(QUOTA), b: "two concerns" });
  assert.equal(result.model, "b");
  assert.equal(result.response, "two concerns");
  assert.deepEqual(asked, ["a", "b"]);
  assert.equal(store.out.a, NOW + ((151 * 60 + 45) * 60 + 8) * 1000);
});

test("a model remembered as out of usage is skipped without asking agy", () => {
  const store = memory({ a: NOW + HOUR });
  const { result, asked } = ask(["a", "b"], { a: "unused", b: "no findings" }, store);
  assert.equal(result.model, "b");
  assert.deepEqual(asked, ["b"]);
  assert.deepEqual(result.passed, [{ model: "a", until: new Date(NOW + HOUR) }]);
});

test("a model whose remembered reset has passed is asked again", () => {
  const { result, asked } = ask(["a", "b"], { a: "back", b: "unused" }, memory({ a: NOW - 1 }));
  assert.equal(result.model, "a");
  assert.deepEqual(asked, ["a"]);
});

test("a model too busy to answer passes to the next but is not remembered", () => {
  const { result, store } = ask(["a", "b"], { a: new Error("RESOURCE_EXHAUSTED (code 429): try later"), b: "ok" });
  assert.equal(result.model, "b");
  assert.deepEqual(result.passed, [{ model: "a", why: "was too busy" }]);
  assert.deepEqual(store.out, {});
});

test("a per-minute rate limit that mentions a quota is busy, not used up, so it is not remembered", () => {
  const limit = new Error("RESOURCE_EXHAUSTED: Quota exceeded for quota metric 'Generate requests' per minute");
  const { result, store } = ask(["a", "b"], { a: limit, b: "ok" });
  assert.deepEqual(result.passed, [{ model: "a", why: "was too busy" }]);
  assert.deepEqual(store.out, {});
});

test("a model that runs out of time passes to the next, which may be faster", () => {
  const slow = new Error("the model ran out of time (10m0s) before finishing its answer");
  const { result, store } = ask(["a", "b"], { a: slow, b: "one note" });
  assert.equal(result.model, "b");
  assert.deepEqual(result.passed, [{ model: "a", why: "ran out of time" }]);
  assert.deepEqual(store.out, {});
});

test("a model that tried a blocked command passes to the next, which may keep to the rule, and is not remembered", () => {
  // On 2026-10-24 Opus tried a command during YODC's second look and was blocked with no answer.
  const blocked = new Error("the model gave no answer after trying something it is not allowed to do (RunCommand)");
  const { result, asked, store } = ask(["a", "b"], { a: blocked, b: "no findings" });
  assert.equal(result.model, "b");
  assert.deepEqual(asked, ["a", "b"]);
  assert.deepEqual(result.passed, [{ model: "a", why: "tried a command it may not run" }]);
  assert.deepEqual(store.out, {});
});

test("any other failure is reported with the model's name, without trying another model", () => {
  const agy = fakeAgy({ [FLASH]: new Error("agy is not installed"), [SONNET]: "unused" });
  assert.throws(() => askFirstAvailable([FLASH, SONNET], agy.ask, memory(), () => NOW), {
    message: "Gemini 3.8 Flash (high): agy is not installed",
  });
  assert.deepEqual(agy.asked, [FLASH]);
});

test("when no model answers, the error names each one and why", () => {
  const store = memory({ [ARGON]: NOW + HOUR });
  const agy = fakeAgy({ [OPUS]: new Error(QUOTA) });
  assert.throws(
    () => askFirstAvailable([ARGON, OPUS], agy.ask, store, () => NOW),
    (err) => {
      assert.match(err.message, /^no model answered: Gemini 4 Argon \(high\) is out of usage until /);
      assert.match(err.message, /; Claude Opus 5\.5 \(high\) is out of usage until /);
      return true;
    },
  );
});

test("the reset time is read from agy's message, or is an hour away when it gives none", () => {
  assert.equal(resetsAt("Resets in 2h5m", NOW).getTime(), NOW + 2 * HOUR + 5 * 60_000);
  assert.equal(resetsAt("Resets in 30s.", NOW).getTime(), NOW + 30_000);
  assert.equal(resetsAt("Individual quota reached.", NOW).getTime(), NOW + HOUR);
});

test("the quota file keeps one reset time per model and survives a missing or broken file", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "agy-quota-test-"));
  try {
    const file = path.join(dir, "quota.json");
    const store = quotaFile(file);
    assert.equal(store.outUntil(ARGON, NOW), null);
    store.markOut(ARGON, new Date(NOW + HOUR));
    store.markOut(OPUS, new Date(NOW - HOUR));
    assert.deepEqual(store.outUntil(ARGON, NOW), new Date(NOW + HOUR));
    assert.equal(store.outUntil(OPUS, NOW), null);
    assert.deepEqual(Object.keys(JSON.parse(readFileSync(file, "utf8"))), [ARGON, OPUS]);
    writeFileSync(file, "not json");
    assert.equal(store.outUntil(ARGON, NOW), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the by-line says which model answered, how deep a review it was and why, and whom it stood in for", () => {
  const line = byLine({
    model: OPUS,
    depth: "deep",
    why: "it touches packages/engine/src/a.ts",
    passed: [
      { model: ARGON, until: new Date(NOW + HOUR) },
      { model: FLASH, why: "was too busy" },
    ],
  });
  assert.match(line, /^Claude Opus 5\.5 \(high\), a deep review because it touches packages\/engine\/src\/a\.ts\. /);
  assert.match(line, /Gemini 4 Argon \(high\) is out of usage until .+\. Gemini 3\.8 Flash \(high\) was too busy\.$/);
});

test("every prompt starts by telling the model it can run no command, not even git", () => {
  // agy's settings allow only an exact `git status` (24 Oct 2026); the prompt used to promise four git commands.
  const prompt = buildPrompt("Audit the repo.");
  assert.match(prompt, /^You are running headless/);
  assert.match(prompt, /cannot run any command, not even git/);
  assert.match(prompt, /blocked/);
  assert.match(prompt, /Audit the repo\.$/);
});

test("every prompt gives the model the time limit and a reading budget, so it answers before being cut off", () => {
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

test("a successful reply gives back the model's answer, trimmed", () => {
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
    message: "the model gave no answer after trying something it is not allowed to do (RunCommand)",
  });
});

test("a run cut off by the time limit is reported as unfinished, even if it printed part of an answer", () => {
  // agy's note when the weekly audit on Flash ran past --print-timeout (2026-10-16).
  const stderr = "[agy] print timeout after 10m0s with turn in progress; returning partial output\n";
  for (const response of ["", "Partial notes so far"]) {
    const r = { status: 0, stdout: JSON.stringify({ status: "SUCCESS", response }), stderr };
    assert.throws(() => parseReply(r), { message: "the model ran out of time (10m0s) before finishing its answer" });
  }
});

test("an empty answer with no reason is still reported", () => {
  assert.throws(() => parseReply(reply({ status: "SUCCESS", response: "" })), {
    message: "the model gave no answer (agy status SUCCESS)",
  });
});

test("when agy is missing or prints something that is not JSON, the reason is reported", () => {
  assert.throws(() => parseReply({ error: { code: "ENOENT" } }), { message: "agy is not installed" });
  assert.throws(() => parseReply({ status: 1, stdout: "", stderr: "sign in first\nmore detail" }), {
    message: "agy exited 1: sign in first",
  });
});
