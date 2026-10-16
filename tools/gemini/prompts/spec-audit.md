Audit the task spec(s) in the material file before any code is written.
Follow GEMINI.md. For each issue, read the files and doc sections listed under "Read first".

Look for:
- gaps: behaviour the goal implies that no acceptance criterion covers
- contradictions with docs/architecture.md, CLAUDE.md or the matching .claude/rules/ file
- acceptance criteria that can't be tested, or that a test could pass without the behaviour existing
- missing edge cases: ties, empty hands or decks, simultaneous choices, hidden information, the last turn
- tasks too big for one fresh session: more than about 300 changed lines, or more than one package

Answer per issue, starting each section with "## #<number>", then the findings in the GEMINI.md format.
