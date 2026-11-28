// Whose words on GitHub the tools read. The repository is public: anyone can open an issue, comment, or open a
// pull request from a fork. Only the owner's and collaborators' text is ever a task, an answer or a cue; a
// stranger's is never read as one. tools/sprint/queue.mjs and tools/gemini-audit.mjs ask here.

// GitHub's authorAssociation for the repository's owner and for people given write access to it.
const TRUSTED = new Set(["OWNER", "COLLABORATOR"]);
// The login of an issue this repository's own workflows opened (nightly.yml): gh's JSON shows app/github-actions,
// the REST API github-actions[bot]. No person can sign up as either, and a fork's workflow runs with a read-only
// token, so it can't open one.
const WORKFLOWS = new Set(["app/github-actions", "github-actions[bot]"]);

// The GitHub App the agents' gh signs in as (greenbean-agent, since 28 Nov 2026). It is no collaborator, so its
// authorAssociation is NONE and it is trusted by login. The REST API names it greenbean-agent[bot] and gh's JSON
// app/greenbean-agent as an issue's author; no person's login can hold "[" or "/". greenbeanbot, the suspended
// account before it, stays trusted only as a collaborator: a deleted account's name can be taken again.
const APP = "greenbean-agent";
const APP_FORMS = new Set([`${APP}[bot]`, `app/${APP}`]);
const login = (x) => String(x ?? "").toLowerCase();

// gh's JSON names the App's comments plainly, greenbean-agent, the shape of a person's login. That form is the
// App's only while no account holds the name: plainApp(gh) asks GitHub, and anything but "no such user" (HTTP 404)
// answers false, so a stranger who takes the name is never read as the agents.
export function plainApp(gh) {
  try {
    gh(["api", `users/${APP}`, "--jq", ".type"]);
    return false;
  } catch (err) {
    return /HTTP 404|Not Found/.test(String(err?.message));
  }
}

// Two spellings of one account: the same login in any case, or the App's REST and gh forms.
export function sameAccount(a, b) {
  const x = login(a);
  const y = login(b);
  if (!x || !y) return false;
  return x === y || (APP_FORMS.has(x) && APP_FORMS.has(y));
}

// The login gh is signed in as, or "" when it is signed in as nobody. Not `gh api user`: a GitHub App's
// installation token is refused that call. gh is (args) => stdout, and throws when gh fails.
export const WHO_AM_I = ["auth", "status", "--active", "--json", "hosts", "--jq", '.hosts["github.com"][0].login'];
export function signedInLogin(gh) {
  let out;
  try {
    out = gh(WHO_AM_I).trim();
  } catch {
    return ""; // gh auth status fails when no account is signed in
  }
  return out === "null" ? "" : out; // jq's answer when github.com has no account
}

// A comment by the owner, a collaborator or the App. plain: plainApp()'s answer, for comments read from gh's JSON.
export function trustedComment(c, { plain = false } = {}) {
  if (TRUSTED.has(c.authorAssociation)) return true;
  const who = login(c.author?.login);
  return APP_FORMS.has(who) || (plain && who === APP);
}

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
  return team.has(login) || WORKFLOWS.has(login) || APP_FORMS.has(login.toLowerCase());
}
