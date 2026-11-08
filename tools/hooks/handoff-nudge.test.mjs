import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
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
  assert.match(r.stderr, /write no note: put future work on docs\/follow-ups\.md, close this session's own open notes/);
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
    result("toolu_C1", "saved FRESH1-card-draw.md"),
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

// Note file names carry their save time; the hook judges age against the real clock, so build them from it.
const pad2 = (n) => String(n).padStart(2, "0");
const stampAgo = (days, minutes = 0) => {
  const d = new Date(Date.now() - days * 86_400_000 - minutes * 60_000);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
};
const note = (next) => `# Handoff: t\nheader\n\n## Goal\ng\n\n## Next\n${next}\n`;

test("at session start, tells the owner about open notes and how to resume them", () => {
  const repo = tempRepo({ ".gitignore": ".handoff/\n" });
  assert.equal(sessionStart(repo).stdout, "", "no notes, no message");

  const first = `${stampAgo(0, 10)}-card-draw.md`;
  const second = `${stampAgo(0, 5)}-scoring.md`;
  writeFiles(repo, {
    [`.handoff/${first}`]: note("1. Edit it"),
    ".handoff/done/2026-10-16-0900-old.md": "# Handoff: old\nheader\nResumed: 2026-10-16 10:00\n",
  });
  assert.equal(sessionStart(repo).json?.systemMessage, `Open handoff note: ${first}. Type /handoff resume to continue it.`);

  writeFiles(repo, { [`.handoff/${second}`]: note("1. Edit it") });
  assert.match(sessionStart(repo).json?.systemMessage, new RegExp(`^2 open handoff notes, newest ${second}\. Type /handoff resume`));
});

test("at session start, files notes with nothing outstanding and names the old open ones to Claude", () => {
  const repo = tempRepo({ ".gitignore": ".handoff/\n" });
  const finished = `${stampAgo(0, 20)}-finished.md`;
  const old = `${stampAgo(5)}-old-open.md`;
  const fresh = `${stampAgo(0, 5)}-fresh-open.md`;
  writeFiles(repo, {
    [`.handoff/${finished}`]: note("Complete"),
    [`.handoff/${old}`]: note("1. Still to do"),
    [`.handoff/${fresh}`]: note("1. Still to do"),
  });
  const r = sessionStart(repo);
  assert.equal(r.status, 0);
  assert.match(r.json.systemMessage, /^Filed 1 handoff note\(s\) that said Complete with nothing outstanding\. 2 open handoff notes/);
  assert.match(r.json.systemMessage, /1 of them are over 3 days old/);
  const context = r.json.hookSpecificOutput.additionalContext;
  assert.equal(r.json.hookSpecificOutput.hookEventName, "SessionStart");
  assert.ok(context.includes(old) && !context.includes(fresh), context);
  assert.match(context, /handoff-notes\.mjs close <name> <reason>/);
  assert.ok(existsSync(path.join(repo, ".handoff", "done", finished)));
  assert.ok(!existsSync(path.join(repo, ".handoff", finished)));
});

test("at session start, a note that only said Complete is filed quietly for Claude", () => {
  const repo = tempRepo({ ".gitignore": ".handoff/\n" });
  writeFiles(repo, { [`.handoff/${stampAgo(0, 5)}-finished.md`]: note("Complete") });
  const r = sessionStart(repo);
  assert.match(r.json.systemMessage, /^Filed 1 handoff note\(s\)/);
  assert.equal(r.json.hookSpecificOutput, undefined);
});

test("at session start outside a git repository, says nothing", () => {
  const r = sessionStart(mkdtempSync(path.join(os.tmpdir(), "td-nogit-")));
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
});
