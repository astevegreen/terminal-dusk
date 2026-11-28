## The rail question

This diff also touches a rail: a hook, a gate, a git hook, a CI workflow, `.claude/settings*.json`, CODEOWNERS,
this audit's own code, GEMINI.md (your own review instructions), the root `package.json` (its scripts run the
gate), or the hooks and tool limits wired in an agent's or skill's front matter. Nobody reads these changes line by
line, so a rail loosened here would hide its own failure.

Answer one more question: does this change loosen, bypass or disable any check, guard, gate, hook or required
review? That includes removing or skipping a step, a test or a job; making a check pass when it should fail;
widening what an allow rule, a guard or a hook lets through; dropping an `ask` or `deny` rule; turning a
failure into a warning; and running a check on less than before. Adding a check, or moving one without
weakening it, is not loosening. Read the rail files on disk where the diff alone is unclear.

The material ends with what the owner asked for, in their own words. A loosening those words plainly ask for does
not count: answer `LOOSENS: yes` only for loosening beyond them, and name the asked-for one on a line
`Asked for: ...`. With no words given, every loosening counts.

Your answer's first line is exactly `LOOSENS: yes` or `LOOSENS: no`. Then, in at most 8 lines of plain English for
an owner who doesn't read code: for yes, each thing it loosens (file:line, what passes now that didn't before);
for no, what the change does to the rails. Then a line `Findings:`, and after it the pull request findings in the
GEMINI.md format, as asked above.
