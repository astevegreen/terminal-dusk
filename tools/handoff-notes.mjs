// Handoff notes for the /handoff skill. Notes live in .handoff/ at the main checkout, so sessions in
// every worktree share them; the folder is git-ignored, so notes are never committed or pushed.
//   node tools/handoff-notes.mjs save <file>    stamp line 2 (time, branch, HEAD, tree, folder) and file the note
//   node tools/handoff-notes.mjs list           open notes, newest first
//   node tools/handoff-notes.mjs claim [name]   move a note to .handoff/done/, print it and what changed since
//   node tools/handoff-notes.mjs close <name> <reason>   file a note whose work is done (or overtaken) in done/
// A note exists only for work still open: save refuses one whose Next reads "Complete" with no Decide first or
// Waiting on, and the SessionStart sweep files any such note that is open and lists notes older than STALE_DAYS.
// Exit codes: 0 done, 1 error, 3 another session claimed the note first, 4 several notes are open: name one.
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { canonical, git, toPosix } from "./hooks/shared.mjs";
import { renameRetry } from "./rename-retry.mjs";

const MAX_LINES = 40;
export const STALE_DAYS = 3;
const NOTHING_LEFT =
  "nothing is outstanding (Next reads Complete); put future work on docs/follow-ups.md and write no note";
const STAMP = /^\d{4}-\d{2}-\d{2}-\d{4}-/;
const SAVED = /^\d{4}-\d{2}-\d{2}-\d{4}-.+\.md$/;
const HEADER = /· branch (\S+) · HEAD (\S+) · (clean|\d+ uncommitted) · (.+)$/;
const caseless = process.platform === "win32" || process.platform === "darwin";
const same = (a, b) => {
  const norm = (p) => toPosix(canonical(p));
  return caseless ? norm(a).toLowerCase() === norm(b).toLowerCase() : norm(a) === norm(b);
};
const pad = (n) => String(n).padStart(2, "0");
const count = (status) => (status ?? "").split("\n").filter(Boolean).length;

// Local time: notes are read by the owner on this PC.
export function stamp(now) {
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return {
    text: `${day} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
    file: `${day}-${pad(now.getHours())}${pad(now.getMinutes())}`,
  };
}

// .handoff/ at the main checkout: the folder that holds the shared .git directory.
export function storeDir(cwd) {
  const common = git(["rev-parse", "--path-format=absolute", "--git-common-dir"], cwd);
  if (!common) throw new Error("not inside a git repository");
  return path.join(path.dirname(common), ".handoff");
}

function treeFacts(cwd) {
  const changed = count(git(["status", "--porcelain"], cwd));
  return {
    root: toPosix(canonical(git(["rev-parse", "--show-toplevel"], cwd))),
    branch: git(["branch", "--show-current"], cwd) || "(detached)",
    head: git(["rev-parse", "--short", "HEAD"], cwd) ?? "none",
    tree: changed ? `${changed} uncommitted` : "clean",
  };
}

export function openNotes(store) {
  if (!existsSync(store)) return [];
  return readdirSync(store)
    .filter((name) => SAVED.test(name))
    .sort()
    .reverse()
    .map((name) => ({ name, header: readFileSync(path.join(store, name), "utf8").split(/\r?\n/)[1] ?? "" }));
}

const format = (notes) => notes.map((n) => `${n.name}  ${n.header}`).join("\n");

// The non-blank lines under a "## <title>" heading, up to the next heading.
function section(lines, title) {
  const start = lines.indexOf(`## ${title}`);
  if (start < 0) return [];
  const end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  return lines.slice(start + 1, end < 0 ? undefined : end).filter((l) => l.trim());
}

// True when a note leaves nothing to do: Next starts with "Complete" and nothing waits on the owner or a run.
export function nothingOutstanding(lines) {
  const next = section(lines, "Next");
  // "Complete", "Complete." or "Complete, nothing left", never a step such as "1. Complete the quiz questions".
  if (next.length !== 1 || !/^(1\.\s*)?complete(\s*$|\s*[.,;:!—–-])/i.test(next[0].trim())) return false;
  return section(lines, "Decide first").length === 0 && section(lines, "Waiting on").length === 0;
}

// When the note was saved, from its file name (local time, as stamp() writes it).
function savedAt(name) {
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})-/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
}
const slugOf = (name) =>
  path
    .basename(name, ".md")
    .replace(STAMP, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function save(file, { cwd = process.cwd(), now = new Date() } = {}) {
  const source = path.resolve(cwd, file);
  if (!existsSync(source)) return { code: 1, out: `not saved: no such file: ${file}` };
  const store = storeDir(cwd);
  const lines = readFileSync(source, "utf8").replace(/\r\n/g, "\n").trimEnd().split("\n");
  const facts = treeFacts(cwd);
  const header = `${stamp(now).text} · branch ${facts.branch} · HEAD ${facts.head} · ${facts.tree} · ${facts.root}`;
  // Line 2 is save's: replace whatever the draft put there, or insert it above the first section.
  const second = lines[1] ?? "";
  const body = second.startsWith("#")
    ? ["", ...lines.slice(1)]
    : second.trim() === ""
      ? lines.slice(1)
      : lines.slice(2);
  const note = [lines[0], header, ...body];

  const problems = [];
  if (!lines[0].startsWith("# Handoff:")) problems.push('line 1 must be "# Handoff: <task in a few words>"');
  for (const section of ["## Goal", "## Next"])
    if (!lines.includes(section)) problems.push(`it has no "${section}" section`);
  if (lines.some((l) => l.startsWith("Resumed:")))
    problems.push("it was claimed (Resumed:) and can't be reopened, so write a new note");
  if (note.length > MAX_LINES) problems.push(`it is ${note.length} lines; keep it to ${MAX_LINES}`);
  if (nothingOutstanding(lines)) problems.push(NOTHING_LEFT);
  if (problems.length) return { code: 1, out: `not saved: ${problems.join("; ")}.` };

  const name = `${stamp(now).file}-${slugOf(source) || "note"}.md`;
  const dest = path.join(store, name);
  mkdirSync(store, { recursive: true });
  writeFileSync(dest, `${note.join("\n")}\n`);
  if (!same(source, dest)) rmSync(source);
  return { code: 0, out: `saved ${name} in ${toPosix(store)}\n${header}`, note: name, store };
}

export function list({ cwd = process.cwd() } = {}) {
  const notes = openNotes(storeDir(cwd));
  return { code: 0, out: notes.length ? format(notes) : "no open handoff notes" };
}

// A full saved name, or the one open note whose slug matches; { code, out } when that is not one note.
function resolve(name, store) {
  name = path.basename(name);
  if (SAVED.test(name)) return { name };
  const matches = openNotes(store).filter((n) => slugOf(n.name) === slugOf(name));
  if (matches.length > 1)
    return { code: 4, out: `${matches.length} open notes named ${slugOf(name)}; ask which:\n${format(matches)}` };
  return { name: matches.length === 1 ? matches[0].name : name };
}

// Move an open note to done/ and append a line. A rename is atomic, so when two sessions take the same note only
// one of them gets it.
function file(store, name, line) {
  const done = path.join(store, "done");
  mkdirSync(done, { recursive: true });
  try {
    renameRetry(path.join(store, name), path.join(done, name));
  } catch {
    return existsSync(path.join(done, name))
      ? { code: 3, out: `already claimed: another session took ${name}` }
      : { code: 1, out: `no open note named ${name}` };
  }
  appendFileSync(path.join(done, name), `${line}\n`);
  return null;
}

export function claim(name, { cwd = process.cwd(), now = new Date() } = {}) {
  const store = storeDir(cwd);
  if (!name) {
    const notes = openNotes(store);
    if (notes.length === 0) return { code: 1, out: "no open handoff notes" };
    if (notes.length > 1)
      return {
        code: 4,
        out: `${notes.length} open notes; ask the owner which one, then run claim <name>:\n${format(notes)}`,
      };
    name = notes[0].name;
  }
  const r = resolve(name, store);
  if (r.code) return r;
  name = r.name;
  const failed = file(store, name, `Resumed: ${stamp(now).text}`);
  if (failed) return failed;
  const text = readFileSync(path.join(store, "done", name), "utf8").trimEnd();
  return {
    code: 0,
    out: `${text}\n\n## Since the note\n${sinceNote(text.split(/\r?\n/)[1], cwd).join("\n")}`,
    note: name,
    store,
  };
}

// File a note nobody needs to resume: its work was finished or overtaken. The reason goes on its Closed: line.
export function close(name, reason, { cwd = process.cwd(), now = new Date() } = {}) {
  if (!name || !reason?.trim())
    return { code: 1, out: "usage: close <name> <reason>: say why the note is no longer needed" };
  const store = storeDir(cwd);
  const r = resolve(name, store);
  if (r.code) return r;
  const failed = file(store, r.name, `Closed: ${stamp(now).text}: ${reason.trim()}`);
  return failed ?? { code: 0, out: `closed ${r.name}` };
}

// SessionStart: file open notes that leave nothing to do, and list those older than STALE_DAYS for the owner.
export function sweep({ cwd = process.cwd(), now = new Date() } = {}) {
  const store = storeDir(cwd);
  const filed = [];
  const stale = [];
  for (const n of openNotes(store)) {
    let lines;
    try {
      lines = readFileSync(path.join(store, n.name), "utf8").replace(/\r\n/g, "\n").split("\n");
    } catch {
      continue;
    }
    if (nothingOutstanding(lines)) {
      if (!file(store, n.name, `Closed: ${stamp(now).text}: swept, nothing outstanding`)) filed.push(n.name);
      continue;
    }
    const at = savedAt(n.name);
    if (at && now - at > STALE_DAYS * 24 * 60 * 60 * 1000) stale.push(n.name);
  }
  return { filed, stale };
}

// The session-ids mod's index of which session saved or claimed which note (<config dir>/session-ids/handoff.json),
// so its Sessions pane lists the note even when the session that ran this doesn't load the mod. Only the command
// line records, and only inside a Claude Code session (CLAUDE_CODE_SESSION_ID); a failure never changes the result.
export function recordSession(kind, note, store, { env = process.env, now = new Date(), rename = renameSync } = {}) {
  const session = env.CLAUDE_CODE_SESSION_ID;
  if (!session || !note || !store) return false;
  try {
    const home = env.USERPROFILE || env.HOME || os.homedir();
    const dir = path.join(env.CLAUDE_CONFIG_DIR || path.join(home, ".claude"), "session-ids");
    const file = path.join(dir, "handoff.json");
    // No index yet starts one. One that won't parse (another writer mid-write) is left alone: replacing it
    // would drop every session's notes from the pane, and the throw below lands in the quiet false.
    let entries = [];
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, "utf8"));
      if (!Array.isArray(parsed?.entries)) return false;
      entries = parsed.entries;
    }
    entries.push({ session, note, store: toPosix(store), kind, at: now.getTime() });
    mkdirSync(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, `${JSON.stringify({ entries: entries.slice(-500) }, null, 1)}\n`);
    renameRetry(tmp, file, { rename });
    return true;
  } catch {
    return false;
  }
}

// The worktree folder that has `branch` checked out, or null.
function checkedOutIn(branch, cwd) {
  const blocks = (git(["worktree", "list", "--porcelain"], cwd) ?? "").split(/\n\s*\n/);
  const block = blocks.find((b) => b.split("\n").includes(`branch refs/heads/${branch}`));
  const folder = block?.match(/^worktree (.+)$/m)?.[1];
  return folder ? toPosix(canonical(folder)) : null;
}

// Where the note's work is now, compared with what its header recorded.
export function sinceNote(header, cwd) {
  const m = HEADER.exec(header ?? "");
  if (!m) return ["Line 2 is not a header that save wrote: check the branch and commits yourself."];
  const [, branch, sha, tree, folder] = m;
  const here = treeFacts(cwd);
  const where = checkedOutIn(branch, cwd);
  const exists = git(["rev-parse", "--verify", "-q", `refs/heads/${branch}`], cwd) !== null;
  const out = [];
  if (where && same(where, here.root)) out.push(`Branch: on ${branch}, as the note was.`);
  else if (where)
    out.push(`Branch: ${branch} is checked out in ${where}. Continue there: the owner opens a session in that folder.`);
  else if (exists)
    out.push(`Branch: this folder is on ${here.branch}. Run \`git switch ${branch}\` to reach the note's work.`);
  else out.push(`Branch: ${branch} is not in this repository (merged and deleted?).`);

  if (git(["cat-file", "-e", `${sha}^{commit}`], cwd) === null)
    out.push(`Commits: the note's HEAD ${sha} is not in this repository.`);
  else if (exists && git(["merge-base", "--is-ancestor", sha, `refs/heads/${branch}`], cwd) === null)
    out.push(`Commits: ${branch} no longer contains the note's HEAD ${sha}.`);
  else if (exists) {
    const log = git(["log", "--oneline", "-10", `${sha}..refs/heads/${branch}`], cwd);
    out.push(
      log ? `Commits on ${branch} since the note:\n${log.replace(/^/gm, "  ")}` : "Commits: none since the note.",
    );
  }

  if (existsSync(folder)) {
    const changed = count(git(["status", "--porcelain"], folder));
    if (changed || tree !== "clean") out.push(`Uncommitted: ${changed} files in ${folder} now; the note saw ${tree}.`);
  } else if (tree !== "clean") {
    out.push(`Uncommitted: the note's folder ${folder} is gone, and its ${tree} files with it.`);
  }
  return out;
}

if (import.meta.main) {
  const [command, arg, ...rest] = process.argv.slice(2);
  let r;
  try {
    if (command === "save" && arg) r = save(arg);
    else if (command === "list") r = list();
    else if (command === "claim") r = claim(arg);
    else if (command === "close") r = close(arg, rest.join(" "));
    else
      r = {
        code: 1,
        out: "usage: node tools/handoff-notes.mjs save <file> | list | claim [name] | close <name> <reason>",
      };
  } catch (err) {
    r = { code: 1, out: `handoff-notes: ${err.message}` };
  }
  if (r.code === 0 && r.note && command !== "close")
    recordSession(command === "save" ? "wrote" : "resumed", r.note, r.store);
  process.stdout.write(`${r.out}\n`);
  process.exit(r.code);
}
