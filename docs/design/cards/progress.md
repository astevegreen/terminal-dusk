# First deck: progress

| Stage | What                                                        | Status |
| ----- | ----------------------------------------------------------- | ------ |
| 1     | Design: deck plan in deck-plan.md, Notion rows as Draft     | done   |
| 2     | Build Era 1 cards and wire the deck into the AI game        | done   |
| 3     | Build Era 2 cards                                           | done   |
| 4     | Build Era 3 cards (and optional 2025-2027 cards if planned) | done   |
| 5     | Review, checks, draft pull request                          | done   |

## Notes

- Stage 1: 102 cards (34 per era: 13 LIO, 13 SAE, 8 neutral) plus 6 optional future cards planned in deck-plan.md, era-1.md, era-2.md, era-3.md and name-swap.md; Notion "Card concepts": 51 rows updated in place and 57 created, all Status Draft (18 of the creates replace original rows that sit in the Notion trash, see Owner question 8); 25 owner questions in deck-plan.md.
- Stage 2: 34 Era 1 cards built with tests (13 LIO, 13 SAE, 8 neutral), TEST scenario `first-deck-test`, the AI game now plays the real deck (test mode keeps its fixture); neutral events cannot run until the engine lifts its points-only rule; owner questions 26-33 added.
- Stage 3: 34 Era 2 cards built with tests (13 LIO, 13 SAE, 8 neutral), all as planned; they enter the TEST scenario at turn 3 through `eras` but sit in the draw pile because hands never refill; owner questions 34-37 added.
- Stage 4: 34 Era 3 cards (13 LIO, 13 SAE, 8 neutral) and the 6 optional future cards built with tests, all as planned; Era 3 enters the TEST scenario at turn 5 and the future cards at turn 6 through `eras`, still dormant in the AI game; ruleset now 108 cards; owner questions 38-43 added.
- Stage 5: all 108 cards checked by hand against their JSON and plan lines (rules text, name, side, Ops all match); one card fix, the wording of the "both sides" Ops change made the same on seven cards ("either side"); seven choices with one clearly better answer, two names close to another game's subjects and the Belt and Road wording logged as owner questions 44-50, not changed, because they follow the approved designs.
- Final checks: `pnpm content:check` passed; content tests 296 passed; `pnpm fuzz:quick` passed (1,000 games); `pnpm gate` passed; `pnpm dev` ran and a few turns against the AI were played in Chromium with the real Era 1 deck.
- CI fix: the e2e test of the AI game now expects the real first-deck note, not the old practice-fixture note; the 108 card tests and the era tests now share two helpers (`describeCard`, `eraChecks`) so SonarCloud no longer flags them as copies; every test name and expected story is unchanged (296 tests).
- SonarCloud fix 2: the tests' sorts now say how to compare (numbers as numbers, ids as text), as SonarCloud asks (a bare sort() compares numbers as text, so 10 would come before 9); each card test's expected story is now a text block with one line per event, and the six cards that ask both sides share `bothSidesAsked`, which removes the copied-looking lists; every test name and expected story line is unchanged (296 content tests, 80 host tests).
- Owner removal: the 18 cards recreated from trashed Notion rows (Owner question 8) are removed; the owner trashed those rows on purpose because the events are not well known or significant enough. The deck is now 90 cards (Era 1: 8 LIO, 13 SAE, 7 neutral; Era 2: 10, 11, 8; Era 3: 8, 12, 7; plus the 6 future cards); their numbers stay unused and the 18 Draft copies in Notion were trashed. With only 8 Era 1 LIO cards, the practice game is now 4 turns with a 6 own + 2 rival + 3 neutral deal per side, the other 6 Era 1 cards go to the draw pile, and the later eras enter on turns 2, 3 and 4. Owner questions 1, 8 and 26 answered; the numbers in the others updated.
- Owner addition: neutral Era 3 card e3-neu-009 "October 7 and Gaza" (Owner question 14), designed with the owner. The deck is now 91 cards (Era 3: 8 LIO, 12 SAE, 8 neutral).
