// What a sprint keeps on its own computer, in the git folder every worktree shares (`git rev-parse
// --git-common-dir`), never committed. A cue can't wait for a pull request to merge, and the supervisor, the
// lanes, the night shift and the archiver all run in this checkout, so they read it here:
//   sprint-window.json    {"start", "end", "environment", "supervisor", "archiver", "wake", "stoppedBy"}: the
//                         window /sprint-start opened, the environment it found, the ids of the scheduled tasks
//                         (the wake is kept across windows), and "sprint-stop" when /sprint-stop ended it
//   sprint-triggers.json  [{"title", "id", "at"}]: every lane or plan trigger the supervisor created, so it never
//                         has to find them in RemoteTrigger's list, which shows only the newest 20
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const WINDOW = "sprint-window.json";
const TRIGGERS = "sprint-triggers.json";

export function stateDir(root) {
  const r = spawnSync("git", ["rev-parse", "--git-common-dir"], { cwd: root, encoding: "utf8", windowsHide: true }); // NOSONAR (javascript:S4036)
  if (r.error || r.status !== 0)
    throw new Error(`git rev-parse --git-common-dir: ${(r.error?.message ?? r.stderr ?? "").trim()}`);
  return path.resolve(root, r.stdout.trim());
}

function readJson(file, empty) {
  if (!existsSync(file)) return empty;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`${file} is not JSON (${err.message}); fix or delete it`, { cause: err });
  }
}

// The whole file, then a rename, so a reader never sees half of one.
function writeJson(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmp, file);
}

export const readWindow = (dir) => (dir ? readJson(path.join(dir, WINDOW), null) : null);
export const writeWindow = (dir, w) => writeJson(path.join(dir, WINDOW), w);
export const readTriggers = (dir) => (dir ? readJson(path.join(dir, TRIGGERS), []) : []);
export const recordTrigger = (dir, entry) => writeJson(path.join(dir, TRIGGERS), [...readTriggers(dir), entry]);
