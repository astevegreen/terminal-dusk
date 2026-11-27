// `queue.mjs move <n> <state>`: the label changes and standard comment for each change of state, planned as
// gh commands from a snapshot. A change the sprint doesn't allow comes back as { error, do }, where `do` is a
// line the coordinator can act on. planMove runs nothing; runMove runs a plan's commands in order. Labels, titles,
// comments and review requests are REST calls (tools/github-rest.mjs), which cloud sessions can make; marking a pull
// request ready or a draft and turning auto-merge on have no REST route, and a cloud session is refused them.
import { addLabelsArgs, commentArgs, is403, removeLabelArgs, reviewRequestArgs, titleArgs } from "../github-rest.mjs";
import {
  BLOCKED,
  HELD_CONFLICT,
  HELD_RAIL,
  MACHINE,
  OWNER,
  RETRY_AFTER_MIN,
  index,
  ownerAnswer,
  taskPr,
} from "./rules.mjs";

const ISSUE_STATES = ["building", "ready", "blocked", "waiting"];
const PR_STATES = ["merging", "held", "stacked"];
const NEXT = "node tools/sprint/queue.mjs next <lane>";

const has = (item, label) => item.labels.includes(label);
const laneOf = (item) => item.labels.find((l) => l.startsWith("lane:")) ?? null;
const refuse = (error, todo) => ({ error, do: todo });
// A change of labels: the new ones first, so a run that stops half way never leaves an item without its state label.
const relabel = (n, add, drop = []) => [
  ...(add.length ? [addLabelsArgs(n, add)] : []),
  ...drop.map((l) => removeLabelArgs(n, l)),
];

function issueMove(S, issue, state, { note }) {
  const n = String(issue.number);
  const lane = laneOf(issue);
  const readyLabel = lane ? "sprint-ready" : "ready";
  const pr = taskPr(issue.number, S);
  if (issue.state !== "OPEN") return refuse(`#${n} is closed`, `Take the next job: ${NEXT}.`);
  const steps = [];
  if (state === "building" && has(issue, "blocked")) {
    // Blocked comes back to building only on the owner's own answer; the comment marks the answer as read.
    if (!ownerAnswer(issue, { ...S, owner: S.owner ?? OWNER }))
      return refuse(`#${n} is blocked`, `Leave it for the owner and take the next job: ${NEXT}.`);
    if (has(issue, "in-progress"))
      return refuse(`#${n} is already in progress`, `Take the next job: ${NEXT}; it says whether this one is stale.`);
    const drop = ["blocked", ...(has(issue, readyLabel) ? [readyLabel] : [])];
    steps.push(
      ...relabel(n, ["in-progress"], drop),
      commentArgs(n, `Unblocked by the owner's answer; the ${lane ? "sprint" : "night shift"} builds it again.`),
    );
  } else if (state === "building") {
    if (has(issue, "in-progress"))
      return refuse(`#${n} is already in progress`, `Take the next job: ${NEXT}; it says whether this one is stale.`);
    if (!has(issue, readyLabel))
      return refuse(`#${n} has no ${readyLabel} label`, `Build only what \`next\` returns: ${NEXT}.`);
    steps.push(...relabel(n, ["in-progress"], [readyLabel]));
  } else if (state === "ready") {
    if (!has(issue, "in-progress"))
      return refuse(`#${n} is not in progress, so there is nothing to re-queue`, `Take the next job: ${NEXT}.`);
    if (has(issue, "blocked"))
      return refuse(
        `#${n} is blocked, and a blocked issue never goes back to ${readyLabel}`,
        `Run: node tools/sprint/queue.mjs move ${n} blocked`,
      );
    if (pr)
      return refuse(
        `#${n} already has pull request #${pr.number}`,
        `Run: node tools/sprint/queue.mjs move ${n} waiting`,
      );
    steps.push(...relabel(n, [readyLabel], ["in-progress"]));
    // With a note, a machine failure stopped the task: it is tried again after an hour, never left for the owner (P2).
    const body = note
      ? `${MACHINE} ${note.startsWith(MACHINE) ? note.slice(MACHINE.length).trim() : note} It retries by itself after ${RETRY_AFTER_MIN} minutes.`
      : `Re-queued by the ${lane ? "sprint" : "night shift"}: the previous ${lane ? "lane " : ""}session stopped.`;
    steps.push(commentArgs(n, body));
  } else if (state === "blocked") {
    steps.push(...relabel(n, ["blocked"], has(issue, "in-progress") ? ["in-progress"] : []));
    if (note) steps.push(commentArgs(n, note.startsWith(BLOCKED) ? note : `${BLOCKED} ${note}`));
  } else {
    // An adopted ready issue leaves the ready queue as well.
    const drop = ["in-progress", readyLabel].filter((l) => has(issue, l));
    steps.push(...relabel(n, [], drop));
    if (lane && pr && !has(pr, lane)) steps.push(addLabelsArgs(String(pr.number), [lane]));
  }
  return { steps };
}

function prMove(S, pr, state, { note, conflict, rail, blocker }) {
  const n = String(pr.number);
  const lane = laneOf(pr) ?? laneOf(index(S).get(pr.closes[0]) ?? { labels: [] });
  if (pr.state !== "OPEN")
    return refuse(`pull request #${n} is ${pr.state.toLowerCase()}`, `Take the next job: ${NEXT}.`);
  const steps = [];
  const addLabels = [...(lane && !has(pr, lane) ? [lane] : [])];
  if (state === "merging") {
    if (pr.base !== "main")
      return refuse(
        `pull request #${n} is stacked on ${pr.base}: merging it now would land it there, not on main`,
        `Run: node tools/sprint/queue.mjs move ${n} stacked`,
      );
    if (pr.isDraft) steps.push(["pr", "ready", n]);
    const title = pr.title.replace(/^\[stacked on #\d+\]\s*/, "");
    if (title !== pr.title) steps.push(titleArgs(n, title));
    steps.push(...relabel(n, addLabels, has(pr, "held") ? ["held"] : []));
    // P1: [minor] concerns and agy's notes merge with the change, as a note on it.
    if (note) steps.push(commentArgs(n, `Merging with notes (they hold nothing): ${note}`));
    steps.push(["pr", "merge", n, "--auto", "--squash"]);
    // A code-owned change waits for the owner; asking for the review gives the owner a review button.
    if (pr.reviewRequired && !pr.reviewers?.includes(OWNER)) steps.push(reviewRequestArgs(n, OWNER));
  } else if (state === "held") {
    let flag = "--blocker";
    if (conflict) flag = "--conflict";
    else if (rail) flag = "--rail";
    if (!note)
      return refuse(
        "a hold needs the concerns",
        `Run: node tools/sprint/queue.mjs move ${n} held ${flag} --note "<${conflict ? "the conflict" : "the blockers"}>"`,
      );
    // P1: only a [blocker], a merge conflict or a loosened rail (P4) holds. agy's verdict lists its blockers without
    // the [blocker] tag, so --blocker says they are blockers. A refused hold leaves the pull request as it is: a
    // blocker must never merge because its tag was lost on the way here.
    if (!conflict && !rail && !blocker && !/\[blocker\]/i.test(note))
      return refuse(
        "a hold needs a [blocker]: the note names none and --blocker was not given",
        `If these are blockers (the reviewer's [blocker]s, or the blockers in agy's verdict), run: node tools/sprint/queue.mjs move ${n} held --blocker --note "<the blockers>". Leave the pull request as it is until then.`,
      );
    if (pr.isDraft && pr.base === "main") steps.push(["pr", "ready", n]);
    steps.push(...relabel(n, [...addLabels, ...(has(pr, "held") ? [] : ["held"])]));
    let body = `Held: ${blocker && !/\[blocker\]/i.test(note) ? `[blocker] ${note}` : note}`;
    if (conflict) body = `${HELD_CONFLICT} ${note}`;
    else if (rail) body = `${HELD_RAIL} ${note}`;
    steps.push(commentArgs(n, body));
  } else {
    if (pr.base === "main")
      return refuse(`pull request #${n} is on main, not stacked`, `Run: node tools/sprint/queue.mjs move ${n} merging`);
    const dep = S.prs.find((p) => p.state === "OPEN" && p.head === pr.base);
    if (!dep)
      return refuse(
        `no open pull request has ${pr.base} as its branch`,
        "Stop and report: the stacked pull request's base is gone.",
      );
    if (!pr.isDraft) steps.push(["pr", "ready", n, "--undo"]);
    const title = pr.title.startsWith("[stacked on") ? pr.title : `[stacked on #${dep.number}] ${pr.title}`;
    if (title !== pr.title) steps.push(titleArgs(n, title));
    steps.push(...relabel(n, addLabels, has(pr, "held") ? ["held"] : []));
  }
  return { steps };
}

// The gh commands that move issue or pull request `n` to `state`, or { error, do }.
export function planMove(S, n, state, opts = {}) {
  const item = index(S).get(Number(n));
  const all = `issues: ${ISSUE_STATES.join(", ")}; pull requests: ${PR_STATES.join(", ")}`;
  if (!item)
    return refuse(
      `#${n} is not an open issue or pull request this queue knows`,
      "Check the number; take jobs only from `next`.",
    );
  const isPr = S.prs.includes(item);
  if (![...ISSUE_STATES, ...PR_STATES].includes(state)) return refuse(`unknown state "${state}"`, `Use one of ${all}.`);
  if (isPr && !PR_STATES.includes(state))
    return refuse(
      `#${n} is a pull request; "${state}" is for issues`,
      `Use one of ${PR_STATES.join(", ")} for a pull request.`,
    );
  if (!isPr && !ISSUE_STATES.includes(state))
    return refuse(
      `#${n} is an issue; "${state}" is for pull requests`,
      `Use one of ${ISSUE_STATES.join(", ")} for an issue.`,
    );
  return isPr ? prMove(S, item, state, opts) : issueMove(S, item, state, opts);
}

// `gh pr ready` and `gh pr merge`, which need GraphQL.
const needsGraphql = (step) => step[0] === "pr" && ["ready", "merge"].includes(step[1]);
// A label that is already off: `gh issue edit` passed over it, and the REST call says 404.
const alreadyOff = (step, err) => step.includes("DELETE") && /Label does not exist/.test(err.message);

// Why a failed step was not done: null for a label already off, else GitHub's refusal of a GraphQL step. Any other
// failure is thrown on.
function refusalOf(step, err) {
  if (alreadyOff(step, err)) return null;
  if (!needsGraphql(step) || !is403(err)) throw err;
  return `GitHub refused \`gh ${step.join(" ")}\`: ${err.message}`;
}

// Runs a plan's steps. gh is (args) => stdout and throws on a failure, which is passed on, except:
// - removing a label that is already off;
// - GitHub refusing (403) to mark the pull request ready or a draft, or to turn on auto-merge. A hold stands without
//   leaving draft (its label and comment hold it), so it carries on and says what is left, in `notDone`. A refused
//   auto-merge still runs the other steps; any other refusal stops before anything else changes. Both of those come
//   back as { ran, error, do }: the move is not done.
export function runMove(n, state, steps, gh) {
  const ran = [];
  const notDone = [];
  const todo = `Run it from a local session, or use the route GitHub's message names: node tools/sprint/queue.mjs move ${n} ${state}. Here, take the next job: ${NEXT}.`;
  let unmerged;
  for (const step of steps) {
    try {
      gh(step);
    } catch (err) {
      const refusal = refusalOf(step, err);
      if (refusal) {
        if (step[1] === "merge") unmerged = `#${n} is not set to auto-merge: ${refusal}`;
        else if (state === "held") notDone.push(`#${n} is still a draft: ${refusal}`);
        else return { ran, ...refuse(`#${n} was not moved to ${state}: ${refusal}`, todo) };
        continue;
      }
    }
    ran.push(["gh", ...step]);
  }
  if (unmerged) return { ran, ...refuse(unmerged, todo) };
  return { ran, ...(notDone.length ? { notDone } : {}) };
}
