// The audit script: its command line (these runs stop before any gh or agy call), and auditPr with gh, agy and
// the comment stood in for. The merge gate's rules are tested in tools/gemini/rails.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { auditDuePrs, auditPr, duePrs, pinnedIssue, pinnedIssueOf, report, specMaterial } from "./gemini-audit.mjs";
import { ME, REPO, SHA, diffOf, fake, restComments } from "./gemini-audit.fake.mjs";
import { ORDERS, buildPrompt } from "./gemini/agy.mjs";
import { NO_API, apiPrompt } from "./gemini/gemini-api.mjs";
import { verdictMarker } from "./gemini/rails.mjs";

const SCRIPT = path.join(import.meta.dirname, "gemini-audit.mjs");
const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", windowsHide: true });

test("the usage names the pr <n> merge gate", () => {
  const r = run();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /usage: .*\| pr <n> \[--asked "<owner's words>"\] \|/);
});

test("pr needs a pull request number", () => {
  for (const args of [["pr"], ["pr", "abc"]]) {
    const r = run(...args);
    assert.equal(r.status, 1, args.join(" "));
    assert.match(r.stderr, /usage:/);
  }
});

// --- auditPr, with gh, agy, the comment and the signed-in login stood in for ------------------------------------

const marked = (login, v, sha = SHA) => ({
  author: { login },
  body: `<!-- gemini-audit -->\n${verdictMarker({ sha, blockers: [], notes: [], why: "x", ...v })}\n`,
});

test("auditPr reuses a verdict its own account posted for this commit, without asking agy again", () => {
  const { io, calls } = fake({ comments: [marked(ME, { verdict: "merge" })] });
  const r = auditPr(7, io);
  assert.equal(r.verdict, "merge");
  assert.equal(r.reused, true);
  assert.equal(calls.ask.length, 0);
  assert.equal(calls.post.length, 0);
});

test("auditPr ignores a verdict marker in anyone else's comment: agy reviews again", () => {
  const { io, calls } = fake({
    comments: [marked("someone-else", { verdict: "merge" })],
    answers: { "pr-audit": "[blocker] a.ts:1 wrong" },
  });
  const r = auditPr(7, io);
  assert.equal(r.reused, undefined);
  assert.equal(r.verdict, "fix");
  assert.deepEqual(r.blockers, ["a.ts:1 wrong"]);
  assert.equal(calls.post.length, 1);
});

test("auditPr never reuses a retry, or a verdict for another commit", () => {
  for (const c of [marked(ME, { verdict: "retry" }), marked(ME, { verdict: "merge" }, "older")]) {
    const { io, calls } = fake({ comments: [c] });
    assert.equal(auditPr(7, io).reused, undefined);
    assert.equal(calls.ask.length, 1);
  }
});

test("auditPr asks who it is signed in as only when a comment carries a verdict", () => {
  const { io, calls } = fake();
  auditPr(7, io);
  assert.equal(calls.me, 0);
});

test("auditPr asks the rail question in the same call, in the rail order and never through the Gemini API", () => {
  const { io, calls } = fake({
    diff: diffOf(".github/workflows/ci.yml"),
    answers: { "pr-audit": new Error("no model answered: Claude Opus 5.5 (high) is out of usage") },
  });
  const r = auditPr(7, io);
  assert.equal(calls.ask.length, 1, "one call answers the review and the rail question");
  const [call] = calls.ask;
  assert.equal(call.prompt, "pr-audit");
  assert.equal(call.opts.also, "rail-audit");
  assert.equal(call.opts.order, "rail");
  assert.ok(Object.hasOwn(ORDERS, call.opts.order));
  assert.equal(call.opts.api, NO_API, "a rail change never goes to the Gemini API");
  assert.equal(r.verdict, "retry");
  assert.match(calls.post[0].body, /\*\*Verdict: retry\*\*/);
});

test("a change that touches no rail is reviewed in its depth's order, and may go to the Gemini API", () => {
  const { io, calls } = fake();
  auditPr(7, io);
  assert.deepEqual(calls.ask[0].opts, {});
});

test("the one call's LOOSENS line decides the rail, and its findings the review", () => {
  const answer = "LOOSENS: no\nIt adds a job.\nFindings:\n[blocker] .github/workflows/ci.yml:3 wrong";
  const { io } = fake({ diff: diffOf(".github/workflows/ci.yml"), answers: { "pr-audit": answer } });
  const r = auditPr(7, io);
  assert.equal(r.verdict, "fix");
  assert.deepEqual(r.rails, [".github/workflows/ci.yml"]);
  const held = fake({
    diff: diffOf(".github/workflows/ci.yml"),
    answers: { "pr-audit": "LOOSENS: yes\nIt drops a job." },
  });
  assert.equal(auditPr(7, held.io).verdict, "hold");
});

test("the owner's own words reach a rail change's material, so only loosening beyond them is flagged", () => {
  const { io, calls } = fake({ diff: diffOf(".github/workflows/ci.yml") });
  auditPr(7, io, { asked: "drop the macOS job" });
  assert.match(calls.ask[0].material, /# What the owner asked for, in their own words\n\ndrop the macOS job\n/);
  const none = fake({ diff: diffOf(".github/workflows/ci.yml") });
  auditPr(7, none.io, { asked: undefined });
  assert.match(none.calls.ask[0].material, /No owner's words were given: every loosening counts\./);
  const plain = fake();
  auditPr(7, plain.io, { asked: "drop the macOS job" });
  assert.doesNotMatch(plain.calls.ask[0].material, /What the owner asked for/, "no rail, no rail section");
});

test("auditPr: agy's review can't run on a change that touches no rail, so it retries and never merges", () => {
  const { io, calls } = fake({ answers: { "pr-audit": new Error("agy is not installed") } });
  const r = auditPr(7, io);
  assert.equal(r.verdict, "retry");
  assert.match(calls.post[0].body, /Gemini audit skipped: agy is not installed/);
});

test("auditPr reads the pull request, its comments and its linked task spec through REST, never GraphQL", () => {
  const spec = { number: 12, title: "The spec", body: "Do the thing." };
  const { io, calls } = fake({ body: "Closes #12", issues: { 12: spec } });
  const r = auditPr(7, io);
  assert.equal(r.verdict, "merge");
  assert.match(calls.ask[0].material, /# #12 The spec\n\nDo the thing\./);
  assert.ok(
    calls.gh.every((a) => a[0] === "api" || (a[0] === "pr" && a[1] === "diff")),
    JSON.stringify(calls.gh),
  );
});

test("auditPr reads REST comments as gh's { author: { login } }, so its own verdict is still found", () => {
  const { io, calls } = fake({ comments: [marked(ME, { verdict: "merge" })] });
  assert.equal(auditPr(7, io).reused, true);
  assert.equal(calls.me, 1);
});

// --- the repository is public: what strangers write never reaches agy --------------------------------------------

test("auditPr refuses a fork's pull request before agy sees it, and posts nothing", () => {
  const { io, calls } = fake({ fork: true });
  assert.throws(() => auditPr(7, io), /#7 is from a fork, so it is not audited/);
  assert.deepEqual([calls.ask.length, calls.post.length], [0, 0]);
});

test("prs audits only this repository's own pull requests", () => {
  const pr = (number, isCrossRepository) => ({ number, isCrossRepository, comments: [] });
  assert.deepEqual(
    duePrs([pr(1, false), pr(2, true), pr(3, undefined)]).map((p) => p.number),
    [1],
  );
  // Only a collaborator's audit comment counts: a stranger can't mark a pull request as already audited.
  const audited = (number, authorAssociation) => ({
    ...pr(number, false),
    comments: [{ authorAssociation, body: "<!-- gemini-audit -->\n**Gemini audit: pull request**" }],
  });
  assert.deepEqual(
    duePrs([audited(4, "NONE"), audited(5, "COLLABORATOR")]).map((p) => p.number),
    [4],
  );
});

test("the weekly and narrative audits post on the issue a collaborator opened, not a stranger's of the same name", () => {
  const team = new Set([ME, "greenbeanbot"]);
  const issue = (number, login) => ({ number, title: "Gemini weekly audit", author: { login } });
  assert.equal(pinnedIssueOf([issue(9, "stranger"), issue(4, "greenbeanbot")], "Gemini weekly audit", team), 4);
  assert.equal(pinnedIssueOf([issue(9, "stranger")], "Gemini weekly audit", team), undefined, "so it opens its own");
});

// --- prs and the repo-wide audits' issue in a cloud session, where `gh pr list` and `gh issue list`, `create` and
// `pin` use GraphQL and answer 403 ------------------------------------------------------------------------------

const REFUSED = "HTTP 403: GitHub GraphQL is not available";
const jsonLines = (items) => items.map((i) => JSON.stringify(i)).join("\n");

// gh with these open pull requests and each one's comments; any GraphQL command is refused.
function listing(open) {
  const calls = [];
  const gh = (...args) => {
    calls.push(args);
    if (args[0] !== "api") throw new Error(REFUSED);
    if (args[2] === "repos/{owner}/{repo}/pulls?state=open&per_page=100")
      return jsonLines(open.map((p) => ({ number: p.number, head: { repo: p.repo ?? REPO }, base: { repo: REPO } })));
    const n = Number(/issues\/(\d+)\/comments/.exec(args[2])?.[1]);
    const found = open.find((p) => p.number === n);
    if (!found) throw new Error(`unexpected gh ${args.join(" ")}`);
    return restComments(found.comments ?? []);
  };
  return { gh, calls };
}

test("prs lists the open pull requests and their comments through REST, and audits the due ones", () => {
  const { gh, calls } = listing([
    { number: 1 },
    { number: 2, comments: [marked(ME, { verdict: "merge" })] },
    { number: 3, comments: [marked(ME, { verdict: "retry" })] },
    { number: 4, repo: { full_name: "stranger/terminal-dusk" } },
  ]);
  const audited = [];
  const logged = [];
  auditDuePrs({ gh, audit: (n) => (audited.push(n), { pr: n }), post: assert.fail, log: (l) => logged.push(l) });
  assert.deepEqual(audited, [1, 3]);
  assert.deepEqual(logged, ['{"pr":1}', '{"pr":3}']);
  assert.ok(!calls.some((c) => c.join(" ").includes("issues/4/")), "a fork's comments are not even read");
});

test("prs posts the skipped line on a pull request whose audit fails, and carries on", () => {
  const { gh } = listing([{ number: 1 }, { number: 2 }]);
  const posted = [];
  const audit = (n) => {
    if (n === 1) throw new Error("no diff");
    return { pr: n };
  };
  auditDuePrs({ gh, audit, post: (...a) => posted.push(a), log: () => {} });
  assert.deepEqual(posted, [["pr", 1, "Gemini audit skipped: no diff"]]);
});

const TITLE = "Gemini weekly audit";
const restIssue = (number, login, extra = {}) => ({ number, title: TITLE, user: { login }, ...extra });

// gh with these open issues, ME as the only collaborator, and `gh issue pin` failing with `pin` when it is given.
function issueGh(open, { pin } = {}) {
  const calls = [];
  const log = [];
  const gh = (...args) => {
    calls.push(args);
    if (args[1] === "repos/{owner}/{repo}/collaborators") return `${ME}\n`;
    if (args[2] === "repos/{owner}/{repo}/issues?state=open&per_page=100") return jsonLines(open);
    if (args[2] === "POST" && args[3] === "repos/{owner}/{repo}/issues") return JSON.stringify({ number: 20 });
    if (args[0] === "issue" && args[1] === "pin") {
      if (pin) throw new Error(pin);
      return "";
    }
    throw new Error(args[0] === "api" ? `unexpected gh ${args.join(" ")}` : REFUSED);
  };
  return { calls, log, io: { gh, dry: false, log: (l) => log.push(l) } };
}

test("the repo-wide audits find their issue through REST: a collaborator's, not a stranger's or a pull request", () => {
  const { io, calls } = issueGh([restIssue(9, "stranger"), restIssue(8, ME, { pull_request: {} }), restIssue(4, ME)]);
  assert.equal(pinnedIssue(TITLE, io), 4);
  assert.ok(
    calls.every((c) => c[0] === "api"),
    JSON.stringify(calls),
  );
});

test("a missing issue is opened through REST and pinned with gh", () => {
  const { io, calls, log } = issueGh([restIssue(9, "stranger")]);
  assert.equal(pinnedIssue(TITLE, io), 20);
  assert.deepEqual(calls.at(-1), ["issue", "pin", "20"]);
  assert.ok(calls.at(-2).includes(`title=${TITLE}`));
  assert.deepEqual(log, []);
});

test("a 403 on pinning (no REST route) is logged and the audit goes on; any other failure still stops it", () => {
  const refused = issueGh([], { pin: `gh issue pin failed: ${REFUSED}` });
  assert.equal(pinnedIssue(TITLE, refused.io), 20);
  assert.equal(refused.log.length, 1);
  assert.match(refused.log[0], /#20 is not pinned.*HTTP 403/);
  const full = issueGh([], { pin: "gh issue pin failed: Maximum 3 pinned issues per repository" });
  assert.throws(() => pinnedIssue(TITLE, full.io), /Maximum 3 pinned/);
});

test("a dry run opens no issue", () => {
  const { io, calls } = issueGh([]);
  assert.equal(pinnedIssue(TITLE, { ...io, dry: true }), 0);
  assert.ok(!calls.some((c) => c.includes("--method") || c[0] === "issue"));
});

test("specs reads every issue it is given through gh, one spec after another (not the list index as gh)", () => {
  const issues = { 11: { number: 11, title: "First", body: "one" }, 12: { number: 12, title: "Second", body: "two" } };
  // Neither issue has a comment, so each spec is its body alone.
  const gh = (...args) => (args[1] === "--paginate" ? "" : JSON.stringify(issues[/issues\/(\d+)$/.exec(args[1])[1]]));
  assert.equal(specMaterial(["11", "12"], gh), "# #11 First\n\none\n\n---\n\n# #12 Second\n\ntwo\n");
});

test("a diff too long to send whole is cut with the line the Gemini API refuses, so it never reviews part of it", () => {
  const { io, calls } = fake({ diff: `${diffOf("packages/app/src/x.ts")}+${"x".repeat(200_001)}\n` });
  auditPr(7, io);
  const { material } = calls.ask[0];
  const read = (file) => (file === "m.md" ? material : "");
  assert.throws(() => apiPrompt(buildPrompt("Review this.", "m.md"), read, []), /truncated diff/);
  const whole = fake();
  auditPr(7, whole.io);
  const readWhole = (file) => (file === "m.md" ? whole.calls.ask[0].material : "");
  assert.doesNotThrow(() => apiPrompt(buildPrompt("Review this.", "m.md"), readWhole, []));
});

// --- report: the comment the audit posts -------------------------------------------------------------------------

const answer = (note) => ({
  model: "gemini-4-hydrogen-high",
  depth: "standard",
  why: "x",
  note,
  response: "All clear.",
});

test("the model-list note is quoted under the by-line, one quoted line per line of the note", () => {
  const comment = report("weekly", answer("New Gemini model in agy: gemini-5-helium-high.\nSecond line."));
  assert.match(
    comment,
    /^_Gemini 4 Hydrogen.*_\n> New Gemini model in agy: gemini-5-helium-high\.\n> Second line\.\n\nAll clear\.$/m,
  );
});

test("with no model-list note, the comment is the title, the by-line and the answer", () => {
  const comment = report("weekly", answer(""));
  assert.doesNotMatch(comment, /^>/m);
  assert.match(comment, /^\*\*Gemini audit: weekly\*\*\n_Gemini 4 Hydrogen.*_\n\nAll clear\.$/);
});
