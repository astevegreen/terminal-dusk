---
paths:
  - "**/*.test.ts"
  - "tests/**"
---
# Test rules
- Name each test after the behaviour or acceptance criterion it proves.
- Never delete, skip or loosen a test to make it pass. If a test is wrong, say so in your summary.
- Property tests print their seed on failure; add a fixed regression case for each failure found.
- No snapshots of whole game states; assert the specific values that matter.
- Golden replays change only through `pnpm golden:update`, and only for an intended rules change.
