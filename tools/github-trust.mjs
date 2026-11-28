// Whose words on GitHub the tools read. The repository is public: anyone can open an issue, comment, or open a
// pull request from a fork. Only the owner's and collaborators' text is ever a task, an answer or a cue; a
// stranger's is never read as one. tools/sprint/queue.mjs and tools/gemini-audit.mjs ask here.

// GitHub's authorAssociation for the repository's owner and for people given write access to it.
const TRUSTED = new Set(["OWNER", "COLLABORATOR"]);
// The login of an issue this repository's own workflows opened (nightly.yml): gh's JSON shows app/github-actions,
// the REST API github-actions[bot]. No person can sign up as either, and a fork's workflow runs with a read-only
// token, so it can't open one.
const WORKFLOWS = new Set(["app/github-actions", "github-actions[bot]"]);

// The GitHub App the agents' gh signs in as (greenbean-agent, since 28 Nov 2026). It is not a collaborator, so its
// authorAssociation is NONE: its logins are trusted by name. gh's JSON names it app/greenbean-agent as an issue's
// author and greenbean-agent on a comment, the REST API greenbean-agent[bot]. No person's login can hold "/" or
// "["; the plain form is a person's only if someone takes the name (users/greenbean-agent was 404 on 28 Nov 2026).
export const APP_LOGINS = new Set(["app/greenbean-agent", "greenbean-agent", "greenbean-agent[bot]"]);
// Every login the agents' own posts come under: the App's, and the suspended bot account's while its old comments
// stand. greenbeanbot is trusted as a collaborator, not by name: a deleted account's name can be taken again.
export const AGENT_LOGINS = new Set([...APP_LOGINS, "greenbeanbot"]);
const APP_ISSUE_AUTHORS = new Set(["app/greenbean-agent", "greenbean-agent[bot]"]);

// Two spellings of one account: the same login in any case, or two of the App's forms.
export function sameAccount(a, b) {
  const x = String(a ?? "").toLowerCase();
  const y = String(b ?? "").toLowerCase();
  if (!x || !y) return false;
  return x === y || (APP_LOGINS.has(x) && APP_LOGINS.has(y));
}

// The login gh is signed in as. Not `gh api user`: a GitHub App's installation token is refused that call. gh is
// (args) => stdout.
export const WHO_AM_I = ["auth", "status", "--active", "--json", "hosts", "--jq", '.hosts["github.com"][0].login'];
export const signedInLogin = (gh) => gh(WHO_AM_I).trim();

export const trustedComment = (c) => TRUSTED.has(c.authorAssociation) || APP_LOGINS.has(c.author?.login ?? "");

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

// An issue a collaborator, this repository's own workflow or the agents' App opened. team is collaborators()'s set.
export function trustedIssue(issue, team) {
  const login = issue.author?.login ?? "";
  return team.has(login) || WORKFLOWS.has(login) || APP_ISSUE_AUTHORS.has(login);
}
