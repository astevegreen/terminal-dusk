import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runHook, tempRepo, writeFiles } from "./test-helpers.mjs";

const owner = (text) => ({ type: "user", message: { content: text } });
const said = (tokens, content = [{ type: "text", text: "Done." }]) => ({
  type: "assistant",
  timestamp: new Date().toISOString(),
  message: { content, usage: { input_tokens: 5, cache_read_input_tokens: tokens - 5, cache_creation_input_tokens: 0 } },
});
const toolUse = (id, name, input) => ({ type: "tool_use", id, name, input });
const result = (id, text) => ({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content: text }] } });
const notification = (id) =>
  owner(`<task-notification>\n<tool-use-id>${id}</tool-use-id>\n<status>completed</status>\n</task-notification>`);

function stop(entries, { session = randomUUID(), window = "200000" } = {}) {
  const transcript = path.join(mkdtempSync(path.join(os.tmpdir(), "td-handoff-")), "t.jsonl");
  writeFileSync(transcript, entries.map((e) => JSON.stringify(e)).join("\n"));
  return runHook("handoff-nudge.mjs", { hook_event_name: "Stop", session_id: session, transcript_path: transcript, cwd: os.tmpdir() }, {
    env: { CLAUDE_CODE_AUTO_COMPACT_WINDOW: window },
  });
}

test("stays quiet below 60% of the auto-compact window", () => {
  const r = stop([owner("Add card draw."), said(119_000)]);
  assert.equal(r.status, 0);
  assert.equal(r.stdout + r.stderr, "");
});

test("past the line, sends Claude back to write the handoff, once per session", () => {
  const session = randomUUID();
  const r = stop([owner("Add card draw."), said(125_000)], { session });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /125k tokens, past the handoff line \(120k/);
  assert.match(r.stderr, /\/handoff/);
  assert.equal(stop([owner("Go on."), said(130_000)], { session }).status, 0, "already asked in this session");
});

test("asks again after a compaction brings the context back under the line", () => {
  const session = randomUUID();
  assert.equal(stop([owner("a"), said(125_000)], { session }).status, 2);
  assert.equal(stop([owner("b"), said(40_000)], { session }).status, 0);
  assert.equal(stop([owner("c"), said(125_000)], { session }).status, 2);
});

test("the line follows the auto-compact window setting", () => {
  assert.equal(stop([owner("a"), said(59_000)], { window: "100000" }).status, 0);
  assert.equal(stop([owner("a"), said(61_000)], { window: "100000" }).status, 2);
});

test("waits for background work to finish, then asks on the turn after its notification", () => {
  const session = randomUUID();
  const launched = [
    owner("Run the fuzz."),
    said(125_000, [toolUse("toolu_A1", "Bash", { command: "pnpm fuzz:quick", run_in_background: true })]),
    result("toolu_A1", "Command running in background with ID: b1"),
    said(125_000),
  ];
  assert.equal(stop(launched, { session }).status, 0, "the fuzz run is still going");
  assert.equal(stop([...launched, notification("toolu_A1"), said(126_000)], { session }).status, 2);
});

test("a foreground command whose output mentions background work doesn't hold it", () => {
  const r = stop([
    owner("Search the logs."),
    said(125_000, [toolUse("toolu_B1", "Bash", { command: "grep background log.txt" })]),
    result("toolu_B1", "Command running in background with ID: old"),
    said(125_000),
  ]);
  assert.equal(r.status, 2);
});

test("doesn't ask when this turn already saved a handoff", () => {
  const r = stop([
    owner("/handoff"),
    said(125_000, [toolUse("toolu_C1", "Bash", { command: "node tools/handoff-notes.mjs save .handoff/card-draw.md" })]),
    result("toolu_C1", "saved 2026-10-17-1405-card-draw.md"),
    said(125_000),
  ]);
  assert.equal(r.status, 0);
});

test("leaves the night shift alone: no owner is there to resume a note", () => {
  assert.equal(stop([owner("Run the `/night-shift` skill."), said(150_000)]).status, 0);
});

test("finishes quietly on input it can't read", () => {
  const missing = runHook("handoff-nudge.mjs", { hook_event_name: "Stop", session_id: "x", transcript_path: path.join(os.tmpdir(), "no-such.jsonl") });
  assert.equal(missing.status, 0);
  assert.equal(runHook("handoff-nudge.mjs", {}).status, 0);
});

const sessionStart = (cwd) => runHook("handoff-nudge.mjs", { hook_event_name: "SessionStart", source: "clear", cwd });

test("at session start, tells the owner about open notes and how to resume them", () => {
  const repo = tempRepo({ ".gitignore": ".handoff/\n" });
  assert.equal(sessionStart(repo).stdout, "", "no notes, no message");

  writeFiles(repo, {
    ".handoff/2026-10-17-1405-card-draw.md": "# Handoff: card draw\nheader\n",
    ".handoff/done/2026-10-16-0900-old.md": "# Handoff: old\nheader\nResumed: 2026-10-16 10:00\n",
  });
  assert.equal(sessionStart(repo).json?.systemMessage, "Open handoff note: 2026-10-17-1405-card-draw.md. Type /handoff resume to continue it.");

  writeFiles(repo, { ".handoff/2026-10-17-1530-scoring.md": "# Handoff: scoring\nheader\n" });
  assert.match(sessionStart(repo).json?.systemMessage, /^2 open handoff notes, newest 2026-10-17-1530-scoring\.md\. Type \/handoff resume/);
});

test("at session start outside a git repository, says nothing", () => {
  const r = sessionStart(mkdtempSync(path.join(os.tmpdir(), "td-nogit-")));
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
});
