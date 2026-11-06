// The REST reads that stand in for `gh pr view`, `gh issue view` and `gh pr comment` (GraphQL, refused in cloud
// sessions): each gives the shape the GraphQL command gave.
import { test } from "node:test";
import assert from "node:assert/strict";
import { comment, comments, issue, pullRequest } from "./github-rest.mjs";
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
