import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { claim, list, save, sinceNote } from "./handoff-notes.mjs";
import { canonical, toPosix } from "./hooks/shared.mjs";
import { sh, tempRepo, writeFiles } from "./hooks/test-helpers.mjs";

const NOW = new Date(2026, 9, 17, 14, 5);
const LATER = new Date(2026, 9, 17, 15, 30);
const DRAFT =
  "# Handoff: card draw\n(save fills this line)\n\n## Goal\nDraw cards.\n\n## Next\n1. Edit packages/engine/src/draw.ts\n";
const posix = (p) => toPosix(canonical(p));
const repoWithNotes = () => tempRepo({ ".gitignore": ".handoff/\n" });
const lineTwo = (file) => readFileSync(file, "utf8").split("\n")[1];

function saveDraft(cwd, slug, now = NOW, text = DRAFT) {
  writeFiles(cwd, { [`.handoff/${slug}.md`]: text });
  return save(`.handoff/${slug}.md`, { cwd, now });
}

test("save stamps line 2 with the time, branch, HEAD, tree state and folder, and files the note", () => {
  const repo = repoWithNotes();
  writeFiles(repo, { "src/a.ts": "export const a = 1;\n" });
  const r = saveDraft(repo, "card-draw");
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^saved 2026-10-17-1405-card-draw\.md/);
  const note = path.join(repo, ".handoff", "2026-10-17-1405-card-draw.md");
  const head = sh("git", ["rev-parse", "--short", "HEAD"], repo);
  assert.equal(lineTwo(note), `2026-10-17 14:05 · branch main · HEAD ${head} · 1 uncommitted · ${posix(repo)}`);
  assert.ok(!existsSync(path.join(repo, ".handoff", "card-draw.md")), "the draft is filed, not left beside the note");
});

test("a note saved in a worktree goes to the main checkout's .handoff folder", () => {
  const repo = repoWithNotes();
  const wt = path.join(repo, "..", `${path.basename(repo)}-wt`);
  sh("git", ["worktree", "add", "-q", "-b", "task/7", wt], repo);
  assert.equal(saveDraft(wt, "card-draw").code, 0);
  const note = path.join(repo, ".handoff", "2026-10-17-1405-card-draw.md");
  assert.ok(existsSync(note), "the note is in the main checkout");
  assert.match(lineTwo(note), new RegExp(`branch task/7 · .* · ${posix(wt).replace(/[.\\]/g, "\\$&")}$`));
  assert.ok(!existsSync(path.join(wt, ".handoff", "card-draw.md")));
});

test("save refuses a note a cold reader couldn't start from, and files nothing", () => {
  const repo = repoWithNotes();
  const cases = [
    [DRAFT.replace("## Next", "## Later"), /no "## Next" section/],
    [DRAFT.replace("# Handoff: card draw", "# Card draw"), /line 1 must be/],
    [DRAFT + "x\n".repeat(40), /keep it to 40/],
    [`${DRAFT}Resumed: 2026-10-17 15:30\n`, /write a new note/],
  ];
  for (const [text, why] of cases) {
    const r = saveDraft(repo, "bad", NOW, text);
    assert.equal(r.code, 1);
    assert.match(r.out, why);
  }
  assert.equal(list({ cwd: repo }).out, "no open handoff notes");
});

test("list shows open notes newest first, with their header line, and not claimed ones", () => {
  const repo = repoWithNotes();
  assert.equal(list({ cwd: repo }).out, "no open handoff notes");
  saveDraft(repo, "card-draw", NOW);
  saveDraft(repo, "scoring", LATER);
  const lines = list({ cwd: repo }).out.split("\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^2026-10-17-1530-scoring\.md {2}2026-10-17 15:30 · branch main/);
  assert.match(lines[1], /^2026-10-17-1405-card-draw\.md/);
  claim("2026-10-17-1530-scoring.md", { cwd: repo, now: LATER });
  assert.match(list({ cwd: repo }).out, /^2026-10-17-1405-card-draw\.md {2}/);
});

test("claim takes the only open note, marks it Resumed and reports commits made since", () => {
  const repo = repoWithNotes();
  saveDraft(repo, "card-draw");
  writeFiles(repo, { "src/b.ts": "export const b = 1;\n" });
  sh("git", ["add", "-A"], repo);
  sh("git", ["commit", "-q", "-m", "later work"], repo);
  const r = claim(undefined, { cwd: repo, now: LATER });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^# Handoff: card draw\n/);
  assert.match(r.out, /\nResumed: 2026-10-17 15:30\n\n## Since the note\n/);
  assert.match(r.out, /Branch: on main, as the note was\./);
  assert.match(r.out, /Commits on main since the note:\n {2}\w+ later work/);
  assert.ok(existsSync(path.join(repo, ".handoff", "done", "2026-10-17-1405-card-draw.md")));
  assert.equal(list({ cwd: repo }).out, "no open handoff notes");
});

test("claim with several open notes claims nothing and lists them for the owner to pick", () => {
  const repo = repoWithNotes();
  saveDraft(repo, "card-draw", NOW);
  saveDraft(repo, "scoring", LATER);
  const r = claim(undefined, { cwd: repo });
  assert.equal(r.code, 4);
  assert.match(r.out, /2 open notes; ask the owner which one/);
  assert.match(r.out, /scoring\.md[\s\S]*card-draw\.md/);
  assert.equal(list({ cwd: repo }).out.split("\n").length, 2);
});

test("a note another session claimed can't be claimed again", () => {
  const repo = repoWithNotes();
  saveDraft(repo, "card-draw");
  const name = "2026-10-17-1405-card-draw.md";
  assert.equal(claim(name, { cwd: repo }).code, 0);
  const again = claim(name, { cwd: repo });
  assert.equal(again.code, 3);
  assert.match(again.out, /already claimed/);
  assert.equal(readdirSync(path.join(repo, ".handoff", "done")).length, 1);
});

test("since the note sends the next session to the folder or branch that holds the work", () => {
  const repo = repoWithNotes();
  const wt = path.join(repo, "..", `${path.basename(repo)}-wt2`);
  sh("git", ["worktree", "add", "-q", "-b", "task/9", wt], repo);
  writeFiles(wt, { "src/c.ts": "export const c = 1;\n" });
  saveDraft(wt, "card-draw");
  const header = lineTwo(path.join(repo, ".handoff", "2026-10-17-1405-card-draw.md"));

  const fromMain = sinceNote(header, repo).join("\n");
  assert.match(
    fromMain,
    new RegExp(`task/9 is checked out in ${posix(wt).replace(/[.\\]/g, "\\$&")}\\. Continue there`),
  );
  assert.match(fromMain, /Uncommitted: 1 files in .* now; the note saw 1 uncommitted\./);

  sh("git", ["worktree", "remove", "--force", wt], repo);
  const gone = sinceNote(header, repo).join("\n");
  assert.match(gone, /this folder is on main\. Run `git switch task\/9`/);
  assert.match(gone, /folder .* is gone, and its 1 uncommitted files with it\./);
});
