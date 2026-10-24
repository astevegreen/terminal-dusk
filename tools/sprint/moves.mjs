// `queue.mjs move <n> <state>`: the label changes and standard comment for each change of state, planned as
// gh commands from a snapshot. A change the sprint doesn't allow comes back as { error, do }, where `do` is a
// line the coordinator can act on. Nothing here runs gh; queue.mjs runs the planned commands in order.
import { HELD_CONFLICT, OWNER, index, ownerAnswer, taskPr } from "./rules.mjs";

const ISSUE_STATES = ["building", "ready", "blocked", "waiting"];
const PR_STATES = ["merging", "held", "stacked"];
const NEXT = "node tools/sprint/queue.mjs next <lane>";

const has = (item, label) => item.labels.includes(label);
const laneOf = (item) => item.labels.find((l) => l.startsWith("lane:")) ?? null;
const refuse = (error, todo) => ({ error, do: todo });

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
    steps.push(["issue", "edit", n, "--add-label", "in-progress", ...drop.flatMap((l) => ["--remove-label", l])]);
    steps.push([
      "issue",
      "comment",
      n,
      "--body",
      `Unblocked by the owner's answer; the ${lane ? "sprint" : "night shift"} builds it again.`,
    ]);
  } else if (state === "building") {
    if (has(issue, "in-progress"))
      return refuse(`#${n} is already in progress`, `Take the next job: ${NEXT}; it says whether this one is stale.`);
    if (!has(issue, readyLabel))
      return refuse(`#${n} has no ${readyLabel} label`, `Build only what \`next\` returns: ${NEXT}.`);
    steps.push(["issue", "edit", n, "--add-label", "in-progress", "--remove-label", readyLabel]);
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
    steps.push(["issue", "edit", n, "--remove-label", "in-progress", "--add-label", readyLabel]);
    steps.push([
      "issue",
      "comment",
      n,
      "--body",
      `Re-queued by the ${lane ? "sprint" : "night shift"}: the previous ${lane ? "lane " : ""}session stopped.`,
    ]);
  } else if (state === "blocked") {
    steps.push([
      "issue",
      "edit",
      n,
      "--add-label",
      "blocked",
      ...(has(issue, "in-progress") ? ["--remove-label", "in-progress"] : []),
    ]);
    if (note) steps.push(["issue", "comment", n, "--body", note]);
  } else {
    // An adopted ready issue leaves the ready queue as well.
    const drop = ["in-progress", readyLabel].filter((l) => has(issue, l));
    if (drop.length) steps.push(["issue", "edit", n, ...drop.flatMap((l) => ["--remove-label", l])]);
    if (lane && pr && !has(pr, lane)) steps.push(["pr", "edit", String(pr.number), "--add-label", lane]);
  }
  return { steps };
}

function prMove(S, pr, state, { note, conflict }) {
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
    const edit = [
      ...(title !== pr.title ? ["--title", title] : []),
      ...addLabels.flatMap((l) => ["--add-label", l]),
      ...(has(pr, "held") ? ["--remove-label", "held"] : []),
    ];
    if (edit.length) steps.push(["pr", "edit", n, ...edit]);
    steps.push(["pr", "merge", n, "--auto", "--squash"]);
    // A code-owned change waits for the owner; asking for the review gives the owner a review button.
    if (pr.reviewRequired && !pr.reviewers?.includes(OWNER)) steps.push(["pr", "edit", n, "--add-reviewer", OWNER]);
  } else if (state === "held") {
    if (!note)
      return refuse(
        "a hold needs the concerns",
        `Run: node tools/sprint/queue.mjs move ${n} held --note "<the concerns>"${conflict ? " --conflict" : ""}`,
      );
    if (pr.isDraft && pr.base === "main") steps.push(["pr", "ready", n]);
    steps.push([
      "pr",
      "edit",
      n,
      ...[...addLabels, ...(has(pr, "held") ? [] : ["held"])].flatMap((l) => ["--add-label", l]),
    ]);
    steps.push(["pr", "comment", n, "--body", conflict ? `${HELD_CONFLICT} ${note}` : `Held: ${note}`]);
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
    const edit = [
      ...(title !== pr.title ? ["--title", title] : []),
      ...addLabels.flatMap((l) => ["--add-label", l]),
      ...(has(pr, "held") ? ["--remove-label", "held"] : []),
    ];
    if (edit.length) steps.push(["pr", "edit", n, ...edit]);
  }
  return { steps: steps.filter((s) => !(s[1] === "edit" && s.length === 3)) };
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
