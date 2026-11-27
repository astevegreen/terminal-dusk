// The REST reads and writes that stand in for `gh issue` and `gh pr` commands (GraphQL, refused in cloud
// sessions): each read gives the shape the GraphQL command gave.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addLabelsArgs,
  comment,
  commentArgs,
  comments,
  createIssue,
  issue,
  openIssues,
  openPullRequests,
  pullRequest,
  removeLabelArgs,
  reviewRequestArgs,
  titleArgs,
} from "./github-rest.mjs";
import { fromFork, trustedComment } from "./github-trust.mjs";

const OURS = { full_name: "astevegreen/terminal-dusk" };
const answering = (out) => {
  const calls = [];
  return { calls, gh: (args) => (calls.push(args), typeof out === "string" ? out : JSON.stringify(out)) };
};
const pr = (head) => ({ number: 5, body: null, head: { sha: "abc", repo: head }, base: { repo: OURS } });

test("pullRequest reads the number, body, head commit and whether the branch is in a fork", () => {
  const { gh, calls } = answering(pr(OURS));
  assert.deepEqual(pullRequest(gh, 5), { number: 5, body: "", headRefOid: "abc", isCrossRepository: false });
  assert.deepEqual(calls, [["api", "repos/{owner}/{repo}/pulls/5"]]);
});

test("a branch in another repository, or in a deleted fork, is a fork's: it fails closed", () => {
  for (const head of [{ full_name: "stranger/terminal-dusk" }, null, undefined]) {
    const p = pullRequest(answering(pr(head)).gh, 5);
    assert.equal(p.isCrossRepository, true, JSON.stringify(head));
    assert.equal(fromFork(p), true);
  }
});

test("comments reads every page, oldest first, as { author: { login }, authorAssociation, body }", () => {
  const lines = [
    { user: { login: "astevegreen" }, author_association: "OWNER", body: "first\nline two" },
    { user: null, author_association: "NONE", body: null },
  ];
  const { gh, calls } = answering(lines.map((l) => JSON.stringify(l)).join("\r\n") + "\n");
  const got = comments(gh, 5);
  assert.deepEqual(got, [
    { author: { login: "astevegreen" }, authorAssociation: "OWNER", body: "first\nline two" },
    { author: { login: "" }, authorAssociation: "NONE", body: "" },
  ]);
  assert.deepEqual(
    got.map((c) => trustedComment(c)),
    [true, false],
  );
  assert.deepEqual(calls, [
    ["api", "--paginate", "repos/{owner}/{repo}/issues/5/comments?per_page=100", "--jq", ".[] | tojson"],
  ]);
  assert.deepEqual(comments(answering("").gh, 5), []);
});

test("issue reads the number, title and body", () => {
  const { gh, calls } = answering({ number: 9, title: "T", body: null, user: { login: "x" } });
  assert.deepEqual(issue(gh, 9), { number: 9, title: "T", body: "" });
  assert.deepEqual(calls, [["api", "repos/{owner}/{repo}/issues/9"]]);
});

test("comment posts the file's text as the body through REST", () => {
  const { gh, calls } = answering("{}");
  comment(gh, 9, "/tmp/c.md");
  assert.deepEqual(calls, [
    ["api", "--method", "POST", "repos/{owner}/{repo}/issues/9/comments", "-F", "body=@/tmp/c.md"],
  ]);
});

const lines = (items) => items.map((i) => JSON.stringify(i)).join("\n") + "\n";

test("openPullRequests reads every page of open pull requests, marking the ones from a fork", () => {
  const stranger = { full_name: "stranger/terminal-dusk" };
  const { gh, calls } = answering(lines([pr(OURS), { ...pr(stranger), number: 6 }]));
  assert.deepEqual(openPullRequests(gh), [
    { number: 5, isCrossRepository: false },
    { number: 6, isCrossRepository: true },
  ]);
  assert.deepEqual(calls, [
    ["api", "--paginate", "repos/{owner}/{repo}/pulls?state=open&per_page=100", "--jq", ".[] | tojson"],
  ]);
  assert.deepEqual(openPullRequests(answering("").gh), []);
});

test("openIssues reads every page of open issues and leaves out the pull requests REST lists with them", () => {
  const { gh, calls } = answering(
    lines([
      { number: 4, title: "A", user: { login: "astevegreen" } },
      { number: 5, title: "A pull request", user: { login: "astevegreen" }, pull_request: { url: "x" } },
      { number: 6, title: "B", user: null },
    ]),
  );
  assert.deepEqual(openIssues(gh), [
    { number: 4, title: "A", author: { login: "astevegreen" } },
    { number: 6, title: "B", author: { login: "" } },
  ]);
  assert.deepEqual(calls, [
    ["api", "--paginate", "repos/{owner}/{repo}/issues?state=open&per_page=100", "--jq", ".[] | tojson"],
  ]);
});

test("createIssue opens the issue through REST, its title and body as plain text, and returns its number", () => {
  const { gh, calls } = answering({ number: 42 });
  assert.equal(createIssue(gh, "T", "@not-a-file"), 42);
  assert.deepEqual(calls, [
    ["api", "--method", "POST", "repos/{owner}/{repo}/issues", "-f", "title=T", "-f", "body=@not-a-file"],
  ]);
});

test("the write arguments are REST calls; -f keeps a value as text, even one starting with @", () => {
  const at = "repos/{owner}/{repo}/issues/9";
  assert.deepEqual(addLabelsArgs(9, ["held", "lane:app"]), [
    ...["api", "--method", "POST", `${at}/labels`],
    ...["-f", "labels[]=held", "-f", "labels[]=lane:app"],
  ]);
  assert.deepEqual(removeLabelArgs(9, "lane:app"), ["api", "--method", "DELETE", `${at}/labels/lane%3Aapp`]);
  assert.deepEqual(commentArgs(9, "@x {owner}"), [
    ...["api", "--method", "POST", `${at}/comments`],
    ...["-f", "body=@x {owner}"],
  ]);
  assert.deepEqual(titleArgs(9, "O4a: x"), ["api", "--method", "PATCH", at, "-f", "title=O4a: x"]);
  assert.deepEqual(reviewRequestArgs(9, "astevegreen"), [
    ...["api", "--method", "POST", "repos/{owner}/{repo}/pulls/9/requested_reviewers"],
    ...["-f", "reviewers[]=astevegreen"],
  ]);
});
