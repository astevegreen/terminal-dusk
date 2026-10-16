// PreToolUse (Edit|Write|MultiEdit|NotebookEdit), implementer only: refuse edits to Locked files.
import { readInput, lockedEntry, deny } from "./shared.mjs";

const input = await readInput();
const ti = input.tool_input ?? {};
const file = ti.file_path ?? ti.notebook_path ?? ti.path;
const entry = lockedEntry(file, input.cwd);

if (entry) {
  deny(
    `${file} is a Locked file (${entry}): night runs never edit configuration or gates. ` +
      "If the task needs this change, stop: comment the question on the issue, add the `blocked` label " +
      "and hand back STATUS: BLOCKED.",
  );
}
