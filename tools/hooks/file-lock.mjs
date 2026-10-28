// PreToolUse (Edit|Write|MultiEdit|NotebookEdit), implementer only: refuse edits to Locked files. The implementer
// runs only unattended (night runs and sprint lanes), so the unattended-only Locked paths (CI workflows) count too.
import { readInput, lockedEntry, deny, UNATTENDED_LOCKED } from "./shared.mjs";

const input = await readInput();
const ti = input.tool_input ?? {};
const file = ti.file_path ?? ti.notebook_path ?? ti.path;
const entry = lockedEntry(file, input.cwd, { unattended: true });

if (entry) {
  const what = UNATTENDED_LOCKED.includes(entry)
    ? "a lane or night run never edits a CI workflow, which runs with the repository's secrets as soon as it is pushed"
    : "a lane or night run never edits the guards, hooks or gates that govern its own session";
  deny(
    `${file} is a Locked file (${entry}): ${what}. If the task needs this change, stop: comment ` +
      "`Blocked: needs a day session: <why>` on the issue, add the `blocked` label and hand back STATUS: BLOCKED.",
  );
}
