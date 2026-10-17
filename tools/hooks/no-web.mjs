// PreToolUse (WebFetch) for the night shift: nobody is awake to judge a page, and web pages are
// the main route for prompt injection, so every fetch is blocked. By day WebFetch is allowed.
import { readInput, deny } from "./shared.mjs";

await readInput();
deny("Blocked by no-web: the night shift can't open web pages. Note what you needed in your report for the owner.");
