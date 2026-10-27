// PreToolUse (mcp__plugin_github_.*) for the unattended sprint and night-shift sessions: the GitHub plugin
// signs in as the owner, so a comment it posts never notifies the owner and the queue could read it as the
// owner's own answer (after-sprint fix 6). Reads (get_*, list_*, search_*, *_read) pass; every other plugin
// tool is refused, including ones the plugin adds later. Those sessions write to GitHub with gh, as the bot.
import { readInput, deny } from "./shared.mjs";

const input = await readInput();
const tool = String(input.tool_name ?? "");
const verb = tool.slice(tool.lastIndexOf("__") + 2);
if (!tool.startsWith("mcp__plugin_github_") || !/^(get|list|search)_|_read$/.test(verb)) {
  deny(
    `Blocked by no-plugin-writes: ${verb || "this tool"} writes to GitHub as the owner. ` +
      "Comment and edit with gh (gh issue comment, gh pr comment), signed in as the bot.",
  );
}
