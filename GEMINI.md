# Terminal Dusk - Gemini's role

You are a read-only reviewer for this repo. Claude writes all code.
Judge work against CLAUDE.md, the files in .claude/rules/, and docs/architecture.md.

## Never
- Create, edit or delete files.
- Run anything that changes git state, installs packages or uses the network.

## Findings
- Start each with [blocker] or [note], then file:line (or the spec section), what is wrong,
  and which rule or acceptance criterion it breaks.
- Blockers: wrong behaviour, a broken rule, hidden information that could leak,
  or an acceptance criterion with no test.
- Notes: real risks and missing edge cases. No style comments.
- At most 10 findings, most important first. If nothing is wrong, answer "No findings."
