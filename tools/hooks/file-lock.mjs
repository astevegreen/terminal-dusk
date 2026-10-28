// PreToolUse (Edit|Write|MultiEdit|NotebookEdit), implementer only: refuse edits to Locked files.
import { readInput, lockedEntry, deny } from "./shared.mjs";

const input = await readInput();
const ti = input.tool_input ?? {};
const file = ti.file_path ?? ti.notebook_path ?? ti.path;
const entry = lockedEntry(file, input.cwd);

if (entry) {
  deny(
    `${file} is a Locked file (${entry}): a lane or night run never edits the guards, hooks or gates that govern ` +
      "its own session. If the task needs this change, stop: comment `Blocked: needs a day session: <why>` on the " +
      "issue, add the `blocked` label and hand back STATUS: BLOCKED.",
  );
}
