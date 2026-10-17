// Handoff notes for the /handoff skill. Notes live in .handoff/ at the main checkout, so sessions in
// every worktree share them; the folder is git-ignored, so notes are never committed or pushed.
//   node tools/handoff-notes.mjs save <file>    stamp line 2 (time, branch, HEAD, tree, folder) and file the note
//   node tools/handoff-notes.mjs list           open notes, newest first
//   node tools/handoff-notes.mjs claim [name]   move a note to .handoff/done/, print it and what changed since
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
import path from "node:path";
import { canonical, git, toPosix } from "./hooks/shared.mjs";

const MAX_LINES = 40;
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
  if (problems.length) return { code: 1, out: `not saved: ${problems.join("; ")}.` };

  const slug =
    path
      .basename(source, ".md")
      .replace(/^\d{4}-\d{2}-\d{2}-\d{4}-/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "note";
  const name = `${stamp(now).file}-${slug}.md`;
  const dest = path.join(store, name);
  mkdirSync(store, { recursive: true });
  writeFileSync(dest, `${note.join("\n")}\n`);
  if (!same(source, dest)) rmSync(source);
  return { code: 0, out: `saved ${name} in ${toPosix(store)}\n${header}` };
}

export function list({ cwd = process.cwd() } = {}) {
  const notes = openNotes(storeDir(cwd));
  return { code: 0, out: notes.length ? format(notes) : "no open handoff notes" };
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
  name = path.basename(name);
  const done = path.join(store, "done");
  mkdirSync(done, { recursive: true });
  // A rename is atomic, so when two sessions claim the same note only one of them gets it.
  try {
    renameSync(path.join(store, name), path.join(done, name));
  } catch {
    return existsSync(path.join(done, name))
      ? { code: 3, out: `already claimed: another session took ${name}` }
      : { code: 1, out: `no open note named ${name}` };
  }
  appendFileSync(path.join(done, name), `Resumed: ${stamp(now).text}\n`);
  const text = readFileSync(path.join(done, name), "utf8").trimEnd();
  return { code: 0, out: `${text}\n\n## Since the note\n${sinceNote(text.split(/\r?\n/)[1], cwd).join("\n")}` };
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
  const [command, arg] = process.argv.slice(2);
  let r;
  try {
    if (command === "save" && arg) r = save(arg);
    else if (command === "list") r = list();
    else if (command === "claim") r = claim(arg);
    else r = { code: 1, out: "usage: node tools/handoff-notes.mjs save <file> | list | claim [name]" };
  } catch (err) {
    r = { code: 1, out: `handoff-notes: ${err.message}` };
  }
  process.stdout.write(`${r.out}\n`);
  process.exit(r.code);
}
