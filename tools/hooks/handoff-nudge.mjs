// Stop and SessionStart hook for the /handoff skill (the notes themselves: tools/handoff-notes.mjs).
// Stop: once the conversation passes 60% of the auto-compact window, send Claude back to write a handoff
// before the turn ends (exit 2). Fires once per session, and again only after the context drops below the
// line (a compaction) and climbs past it again. Held while background work runs, so a note never says
// "still running"; skipped for the night shift, which has no owner to resume it.
// SessionStart (startup, clear): tell the owner about open notes. Shown to the owner only, never to Claude.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readInput } from "./shared.mjs";
import { openNotes, storeDir } from "../handoff-notes.mjs";

const SHARE = 0.6;
const STALE_MS = 2 * 60 * 60 * 1000;
const input = await readInput();
if (input.hook_event_name === "SessionStart") sessionStart();
else stop();

function sessionStart() {
  let notes = [];
  try {
    notes = openNotes(storeDir(input.cwd ?? process.cwd()));
  } catch {
    process.exit(0);
  }
  if (notes.length === 0) process.exit(0);
  const message = notes.length === 1
    ? `Open handoff note: ${notes[0].name}. Type /handoff resume to continue it.`
    : `${notes.length} open handoff notes, newest ${notes[0].name}. Type /handoff resume to pick one.`;
  process.stdout.write(JSON.stringify({ systemMessage: message }));
  process.exit(0);
}

function stop() {
  if (!input.transcript_path || !input.session_id) process.exit(0);
  let entries;
  try {
    entries = readFileSync(input.transcript_path, "utf8").split("\n").filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter((e) => e && !e.isSidechain);
  } catch {
    process.exit(0);
  }
  if (nightShift(entries)) process.exit(0);

  const window = Number(process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW) || 200_000;
  const line = Math.round(window * SHARE);
  const context = contextSize(entries);
  const dir = path.join(os.tmpdir(), "terminal-dusk-handoff");
  const marker = path.join(dir, String(input.session_id).replace(/[^\w-]/g, ""));
  if (context < line) {
    rmSync(marker, { force: true });
    process.exit(0);
  }
  // No marker while background work runs: the nudge comes on the turn after its notification.
  if (existsSync(marker) || running(entries)) process.exit(0);
  mkdirSync(dir, { recursive: true });
  writeFileSync(marker, String(context));
  if (savedThisTurn(entries)) process.exit(0);

  process.stderr.write(
    `The conversation is ${Math.round(context / 1000)}k tokens, past the handoff line ` +
      `(${Math.round(line / 1000)}k, 60% of the auto-compact window). Before this turn ends, write a handoff ` +
      `with the handoff skill (/handoff). If the gate is red, get it green first; a question you were about ` +
      `to ask the owner goes under Decide first.\n`,
  );
  process.exit(2);
}

// What the latest model call read, cached or not.
function contextSize(entries) {
  for (let i = entries.length - 1; i >= 0; i--) {
    const usage = entries[i].type === "assistant" && entries[i].message?.usage;
    if (usage) return (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
  }
  return 0;
}

function textOf(content) {
  if (typeof content === "string") return content;
  return Array.isArray(content) ? content.map((p) => p?.text ?? "").join("") : "";
}

function toolUses(entries) {
  return entries.flatMap((e) => (e.type === "assistant" && Array.isArray(e.message?.content) ? e.message.content : []))
    .filter((p) => p?.type === "tool_use");
}

// A message the owner typed: not a tool result, not a meta entry, not a background-task notification.
function isOwnerMessage(e) {
  if (e.type !== "user" || e.isMeta) return false;
  const content = e.message?.content;
  const typed = typeof content === "string" || (Array.isArray(content) && content.some((p) => p?.type === "text"));
  return typed && !textOf(content).trimStart().startsWith("<task-notification>");
}

function nightShift(entries) {
  const first = entries.find(isOwnerMessage);
  if (first && textOf(first.message.content).includes("/night-shift")) return true;
  return toolUses(entries).some((p) => p.name === "Skill" && p.input?.skill === "night-shift");
}

function savedThisTurn(entries) {
  const start = entries.findLastIndex(isOwnerMessage);
  return toolUses(entries.slice(start + 1)).some((p) => /handoff-notes\.mjs"?\s+save\b/.test(String(p.input?.command ?? "")));
}

// Background calls (a shell run_in_background, an async Agent) whose <task-notification> has not arrived.
// A launch older than STALE_MS counts as finished: a task that was stopped or lost never notifies.
function running(entries) {
  const calls = new Map();
  const started = new Set();
  const finished = new Set();
  for (const e of entries) {
    const content = e.message?.content;
    if (e.type === "assistant" && Array.isArray(content)) {
      for (const p of content.filter((x) => x?.type === "tool_use")) {
        const shell = p.input?.run_in_background === true;
        calls.set(p.id, { at: Date.parse(e.timestamp ?? ""), shell, agent: p.name === "Agent" || p.name === "Task" });
      }
    }
    if (e.type === "user" && Array.isArray(content)) {
      // Judged by the launching call and the result's opening words: a foreground command's output can
      // contain the same phrases (a grep of a transcript does).
      for (const p of content.filter((x) => x?.type === "tool_result")) {
        const call = calls.get(p.tool_use_id);
        const text = textOf(p.content).trimStart();
        if ((call?.shell && text.startsWith("Command running in background")) || (call?.agent && text.startsWith("Async agent launched")))
          started.add(p.tool_use_id);
      }
    }
    const raw = JSON.stringify(e);
    if (raw.includes("task-notification")) for (const m of raw.matchAll(/<tool-use-id>(toolu_\w+)<\/tool-use-id>/g)) finished.add(m[1]);
  }
  const now = Date.now();
  return [...started].some((id) => !finished.has(id) && !(now - calls.get(id).at > STALE_MS));
}
