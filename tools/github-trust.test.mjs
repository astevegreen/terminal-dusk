// Whose words on GitHub the tools read, now the repository is public (github-trust.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { collaborators, fromFork, trustedComment, trustedIssue } from "./github-trust.mjs";

test("only the owner's and collaborators' comments are trusted", () => {
  assert.equal(trustedComment({ authorAssociation: "OWNER" }), true);
  assert.equal(trustedComment({ authorAssociation: "COLLABORATOR" }), true);
  // A member of an organisation that might one day own the repository isn't someone with write access to it.
  for (const a of ["MEMBER", "CONTRIBUTOR", "FIRST_TIME_CONTRIBUTOR", "FIRST_TIMER", "MANNEQUIN", "NONE", undefined])
    assert.equal(trustedComment({ authorAssociation: a }), false, String(a));
});

test("a pull request is from a fork unless GitHub says it isn't", () => {
  assert.equal(fromFork({ isCrossRepository: true }), true);
  assert.equal(fromFork({ isCrossRepository: false }), false);
  // A missing field fails closed: the caller forgot to ask gh for it.
  assert.equal(fromFork({}), true);
});

test("collaborators reads every page of the repository's collaborator list", () => {
  const calls = [];
  const team = collaborators((args) => {
    calls.push(args);
    return "astevegreen\r\ngreenbeanbot\n\n";
  });
  assert.deepEqual(calls, [["api", "repos/{owner}/{repo}/collaborators", "--paginate", "--jq", ".[].login"]]);
  assert.deepEqual([...team], ["astevegreen", "greenbeanbot"]);
});

test("an issue counts only when a collaborator or this repository's own workflow opened it", () => {
  const team = new Set(["astevegreen", "greenbeanbot"]);
  assert.equal(trustedIssue({ author: { login: "greenbeanbot" } }, team), true);
  assert.equal(trustedIssue({ author: { login: "app/github-actions" } }, team), true, "nightly.yml's failure issue");
  assert.equal(trustedIssue({ author: { login: "stranger" } }, team), false);
  assert.equal(trustedIssue({}, team), false, "no author fails closed");
});
