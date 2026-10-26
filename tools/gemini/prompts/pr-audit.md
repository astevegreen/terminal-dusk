Audit one pull request. The material file holds its diff and the linked task spec.
Follow GEMINI.md. Read surrounding code from disk only where the diff is unclear.

Check:

- does the diff do what the spec's goal and acceptance criteria say, and nothing outside its scope
- hidden-information leaks: hands, deck order, the RNG seed or secret-compartment state reaching a view,
  a public event, a log line, a test snapshot or client-facing server code
- broken hard rules from CLAUDE.md or the matching .claude/rules/ files
- acceptance criteria without a test that would fail if the change were reverted
- tests deleted, skipped or loosened

Answer with the findings in the GEMINI.md format.
