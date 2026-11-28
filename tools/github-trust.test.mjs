// Whose words on GitHub the tools read, now the repository is public (github-trust.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WHO_AM_I,
  collaborators,
  fromFork,
  plainApp,
  sameAccount,
  signedInLogin,
  trustedComment,
  trustedIssue,
} from "./github-trust.mjs";

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
  // nightly.yml's failure issue: gh's JSON names the workflow app/github-actions, the REST API github-actions[bot].
  assert.equal(trustedIssue({ author: { login: "app/github-actions" } }, team), true, "gh's form");
  assert.equal(trustedIssue({ author: { login: "github-actions[bot]" } }, team), true, "the REST form");
  // A person's login can hold neither "/" nor "[", so only the bracketed or prefixed form is the workflow.
  for (const login of ["github-actions", "app-github-actions", "stranger"])
    assert.equal(trustedIssue({ author: { login } }, team), false, login);
  assert.equal(trustedIssue({}, team), false, "no author fails closed");
});

test("the agents' App is trusted under the logins no person can hold, the plain one only when it is free", () => {
  const team = new Set(["astevegreen", "greenbeanbot"]);
  const by = (login) => ({ author: { login }, authorAssociation: "NONE" });
  for (const login of ["greenbean-agent[bot]", "app/greenbean-agent", "Greenbean-Agent[bot]"])
    assert.equal(trustedComment(by(login)), true, login);
  assert.equal(trustedComment(by("greenbean-agent")), false, "the plain form, by default");
  assert.equal(trustedComment(by("greenbean-agent"), { plain: true }), true, "the plain form, while nobody holds it");
  for (const login of ["greenbean-agent-x", "greenbeanbot", "stranger"])
    assert.equal(trustedComment(by(login), { plain: true }), false, login);
  // An issue's author is the prefixed or bracketed form.
  assert.equal(trustedIssue({ author: { login: "app/greenbean-agent" } }, team), true, "gh's form");
  assert.equal(trustedIssue({ author: { login: "greenbean-agent[bot]" } }, team), true, "the REST form");
  assert.equal(trustedIssue({ author: { login: "greenbean-agent" } }, team), false, "the plain form");
});

test("the plain greenbean-agent is the App's only while GitHub has no such user", () => {
  const calls = [];
  const asked = (answer) => (args) => {
    calls.push(args);
    if (answer instanceof Error) throw answer;
    return answer;
  };
  assert.equal(plainApp(asked(new Error("gh api users/greenbean-agent: gh: Not Found (HTTP 404)"))), true);
  assert.deepEqual(calls[0], ["api", "users/greenbean-agent", "--jq", ".type"]);
  assert.equal(plainApp(asked("User\n")), false, "someone took the name");
  assert.equal(plainApp(asked(new Error("HTTP 502: Bad Gateway"))), false, "GitHub didn't answer: fail closed");
});

test("one account's spellings: case, and the App's REST and gh forms, never the plain one", () => {
  assert.equal(sameAccount("AsteveGreen", "astevegreen"), true);
  assert.equal(sameAccount("greenbean-agent[bot]", "app/greenbean-agent"), true);
  assert.equal(sameAccount("greenbean-agent[bot]", "greenbean-agent"), false);
  assert.equal(sameAccount("greenbean-agent[bot]", "greenbeanbot"), false);
  assert.equal(sameAccount("", ""), false, "no login, no account");
  assert.equal(sameAccount(undefined, "x"), false);
});

test("who-am-I asks gh auth status, which an App token can answer, never gh api user", () => {
  const calls = [];
  const login = signedInLogin((args) => {
    calls.push(args);
    return "greenbean-agent[bot]\n";
  });
  assert.equal(login, "greenbean-agent[bot]");
  assert.deepEqual(calls, [["auth", "status", "--active", "--json", "hosts", "--jq", '.hosts["github.com"][0].login']]);
  assert.deepEqual(WHO_AM_I, calls[0]);
  assert.equal(
    signedInLogin(() => "null\n"),
    "",
    "no github.com account: jq prints null",
  );
  const nobody = () => {
    throw new Error("gh auth status: You are not logged into any GitHub hosts");
  };
  assert.equal(signedInLogin(nobody), "", "gh signed in nowhere");
});
