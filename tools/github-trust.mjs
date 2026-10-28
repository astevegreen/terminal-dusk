// Whose words on GitHub the tools read. The repository is public: anyone can open an issue, comment, or open a
// pull request from a fork. Only the owner's and collaborators' text is ever a task, an answer or a cue; a
// stranger's is never read as one. tools/sprint/queue.mjs and tools/gemini-audit.mjs ask here.

// GitHub's authorAssociation for the repository's owner and for people given write access to it.
const TRUSTED = new Set(["OWNER", "COLLABORATOR"]);
// The login gh shows for an issue this repository's own workflows opened (nightly.yml). A fork's workflow runs
// with a read-only token, so it can't open one.
const WORKFLOWS = "app/github-actions";

export const trustedComment = (c) => TRUSTED.has(c.authorAssociation);

// A pull request whose branch is in a fork. A missing field fails closed: the caller forgot to ask gh for it.
export const fromFork = (p) => p.isCrossRepository !== false;

// The logins with access to the repository, the owner's included. gh is (args) => stdout.
export function collaborators(gh) {
  const out = gh(["api", "repos/{owner}/{repo}/collaborators", "--paginate", "--jq", ".[].login"]);
  return new Set(
    out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
  );
}

// An issue a collaborator or this repository's own workflow opened. team is collaborators()'s set.
export function trustedIssue(issue, team) {
  const login = issue.author?.login ?? "";
  return team.has(login) || login === WORKFLOWS;
}
