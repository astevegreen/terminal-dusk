// How the audits talk to agy: which models, what every prompt starts with, and how a reply is read.

// Which Gemini models the audits use, in order. Pinned on purpose; change them deliberately, not by default.
// Argon gives the deeper review. Flash has its own quota, so it answers when Argon's has run out.
export const MODELS = ["gemini-4-argon-high", "gemini-3.8-flash-high"];

// How long agy may run before it is cut off (its --print-timeout); the prompt tells Gemini so it can pace itself.
export const TIMEOUT = "10m";

// agy runs headless, so it cannot ask before a command; it blocks anything its settings don't allow and the
// model then ends with an empty answer. Its settings allow reading files and these four read-only git commands.
// Each file read takes about 20 seconds, and a model that keeps following references never gets to answer.
const HEADLESS =
  "You are running headless. You can read any file in the repository and run only git diff, git log, git show " +
  "and git status. Every other command is blocked, and a blocked command ends your turn with no answer, " +
  "so never try one: read files instead (for example, to count a file's lines). " +
  `You have ${TIMEOUT} in total and each file read takes about 20 seconds. Read the material first, then ` +
  "at most 15 other files, choosing the ones that matter most, and leave time to write your answer. " +
  "An answer that is not finished in time is thrown away.";

export function buildPrompt(text, materialFile) {
  let prompt = `${HEADLESS}\n\n${text.trim()}`;
  if (materialFile) prompt += `\nThe material is in ${materialFile}. Read all of it before answering.\n`;
  return prompt;
}

// Reads one `agy -p ... --output-format json` run (a spawnSync result) and returns Gemini's answer, or throws why not.
export function parseReply(r) {
  if (r.error) throw new Error(r.error.code === "ENOENT" ? "agy is not installed" : r.error.message);
  let out;
  try {
    out = JSON.parse(r.stdout);
  } catch {
    throw new Error(`agy exited ${r.status}: ${(r.stderr || r.stdout || "").trim().split("\n")[0]}`);
  }
  // Past --print-timeout agy returns whatever the model had written so far; never post that as a finished audit.
  const timedOut = /print timeout after (\S+)/i.exec(r.stderr ?? "")?.[1];
  if (timedOut) throw new Error(`Gemini ran out of time (${timedOut}) before finishing its answer`);
  if (out.status === "SUCCESS" && out.response?.trim()) return out.response.trim();
  if (out.error) throw new Error(out.error);
  const denied = (out.denied_actions ?? []).map((a) => a.display_name ?? a.action);
  if (denied.length)
    throw new Error(`Gemini gave no answer after trying something it is not allowed to do (${denied.join(", ")})`);
  throw new Error(`Gemini gave no answer (agy status ${out.status})`);
}

const isQuotaError = (err) => /quota/i.test(err.message);

// Asks each model in turn until one answers. Only a quota error moves on to the next model; anything else
// (agy missing, a timeout, a blocked command) would fail the same way on every model, so it is thrown as it is.
export function askFirstAvailable(models, ask) {
  let last;
  for (const model of models) {
    try {
      return { model, response: ask(model) };
    } catch (err) {
      if (!isQuotaError(err)) throw err;
      last = err;
    }
  }
  throw new Error(`every model is out of quota (${models.join(", ")}): ${last.message}`);
}
