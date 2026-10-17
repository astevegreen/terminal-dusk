# Terminal Dusk — Core Architecture Decisions

2026-10-15 · Steve

> Copied from the Notion page "Terminal Dusk — Core Architecture Decisions" (last edited 2026-10-16).
> The Notion page also has a diagram, "architecture · trusted side vs viewer side", which is not reproduced here;
> its caption is kept below the summary table.

## Summary

Eight decisions shape everything else, and together they close every development issue the two reviews and our comparison raised. Settle them before the first card is written: changing any of them later means rewriting cards, tests or the server.

| # | Decision | What it settles |
|---|---|---|
| 1 | The engine is one deterministic state machine; every input answers a pending decision | Mid-card interrupts, opponent choices, simultaneous secret picks, timeouts, versioning |
| 2 | Game state is split by who may see it; only filtered views leave the host | Hidden-hand and seed leaks, fair AI, safe spectating |
| 3 | One match host runs every game, local or online; clients only receive frames | Single-player, online play, spectating and replays share one code path; easy move off Supabase |
| 4 | Everything game-specific is data in one schema: cards, map, scenarios, tutorial, mods | Mod safety, server validation, store-safe card wording, a tutorial almost for free |
| 5 | The server is a thin Supabase adapter with exactly one way to change a game | Races, deadlines, notifications, matchmaking, purchases, running costs |
| 6 | The UI only renders frames, and is designed phone-first | Phone map usability, smooth online play, animation and sound, agent omissions |
| 7 | Platform differences sit behind one interface; store shells stay thin | App Store rules, purchases, push, Steam, offline play |
| 8 | The AI is a player that sees only its own view | Fair AI, AI that handles modded cards, difficulty tuning |

*Diagram (in Notion): architecture · trusted side vs viewer side.* Content and the engine live only on the trusted side; the UI, the AI and spectators receive frames and send answers back.

Two ideas run through all eight. The same code runs everywhere, so a bug fixed in single-player is fixed online. And the repository enforces the rules automatically (type checks, boundary checks, a fuzz suite), so you approve behaviour rather than read code.

Each decision below explains itself in plain words first, then gives a spec block for your coding agents.

## What is already settled

These product decisions and stack choices are fixed inputs to the design. Every issue raised along the way is listed in the Coverage section, mapped to the decision that handles it.

**Product decisions (yours)**

- Strictly two players; hidden hands and shuffles; no dice: each side draws from its own outcome deck instead (owner, 16 Oct; details on the Notion page "Outcome deck (replaces dice)"); follows Twilight Struggle closely with some twists.
- Asynchronous online play with variable turn deadlines, plus single-player against an AI with several difficulty levels.
- Sign-in only for online play. Public ranked matchmaking and invite-a-friend games.
- Spectating, shareable replays, an interactive tutorial, music and sound effects. English at launch.
- Separate purchases per platform. Accounts are separate from purchases, so cross-play still works.
- No backward compatibility before v1, only a version stamp and an "update required" check.
- Git from day one.

**Stack (agreed by both reviews)**

| Layer | Choice |
|---|---|
| Language and UI | TypeScript (strict), React, Vite |
| Rendering | SVG map, HTML/CSS cards |
| Rules | Custom pure engine, seeded PRNG, move logs |
| Card effects | Declarative data, named built-ins, Zod schemas |
| Backend | Supabase Pro |
| Auth | Supabase Auth |
| Rankings | Glicko-2 |
| Notifications | Email, native push, web push |
| AI | On-device, in a Web Worker |
| Steam | Electron with Steamworks |
| Mobile | Capacitor 8.5 or newer |
| Web payments | Paddle or Stripe Managed Payments (merchant of record) |
| Mobile pricing | Free download plus one-time "Full Game" unlock (decided, see Product calls) |
| Testing | Vitest, fast-check, Playwright |
| Web hosting | Cloudflare Workers with static assets |

**Launch order:** web, then Steam, then Android, then iOS. Mod sharing, free-text chat and tournament tooling come after v1.

## 1. The engine: one deterministic state machine driven by decisions

The engine is a pure TypeScript package: it takes a game state and an answer, and returns a new state plus a list of events. It never reads the clock, the network or a random function, so the same inputs always produce the same game. Every point where the game waits for a person is a **pending decision**, and every input is an answer to one.

**Why.** Twilight Struggle-style cards stop halfway to ask the other player something. Code that resolves a whole card in one go cannot pause for an online reply that arrives two days later. Making every wait an explicit decision handles interrupts, mid-card choices and normal turn actions with one mechanism.

**How it works**

- A **resolution stack** holds the steps still to run. The engine runs steps until one needs a choice, records that decision, and stops.
- The answer resumes the stack exactly where it stopped. Ordinary turn actions ("play this card for ops or event") are pending decisions too.
- **Simultaneous decisions**, such as a headline phase where both sides pick a card in secret, are a group of pending decisions. The first answer stays hidden from the other side until both are in. Neither review raised this, but Twilight Struggle's headline phase needs it.
- **System actions** (timeout, resignation, adjudication) go through the same path, so the move log is always complete.
- The engine has **no clock**. The match host (Decision 3) tracks time and submits a Timeout action when a deadline passes.
- Each answer produces **events** (influence placed, outcome drawn, card drawn), each tagged with who may see it. The UI animates them, the game log prints them, sounds play from them and the tutorial reacts to them.
- Every game records an `engineVersion` and a `contentHash`. Together they form the **ruleset ID**, which drives the "update required" check now and the compatibility window after v1.

**Spec for agents**

```typescript
// The only exports other packages may use
createGame(ruleset: Ruleset, setup: Setup, seed: Seed): Result<{ state: GameState; events: GameEvent[] }>
apply(state: GameState, answer: Answer): Result<{ state: GameState; events: GameEvent[] }> // illegal answers return a typed error
pendingFor(state: GameState, side: Side): Decision | null

type Decision = {
  id: string;                 // unique within the game; answers quote it
  side: Side;                 // who must answer
  kind: DecisionKind;         // chooseCard | playCardAs | distributeInfluence | chooseCountries | yesNo | ...
  options: DecisionOptions;   // declarative description of what is legal
  simultaneousGroup?: string; // set for secret picks made at the same time
};
type Answer =
  | { decisionId: string; side: Side; value: AnswerValue }
  | { system: 'timeout' | 'resign' | 'adjudicate'; side: Side };
```

- State is plain JSON data: no classes, Maps, Dates or functions. It can be saved, sent, hashed and copied with structuredClone.
- Integers only. No floating-point maths anywhere in the rules.
- One small, published PRNG algorithm (for example sfc32), copied into the repo so no library update can change it.
- `apply` never changes its input. Internally it copies the state once and edits the copy; tests deep-freeze inputs to prove this.
- Ordering is always explicit (arrays, sorted keys), never object key order.
- **Compound answers** are allowed: one "distribute 4 influence" answer carries the whole placement, so online play needs one round trip instead of four.
- A **step budget** per answer (for example 10,000 stack steps) stops runaway trigger loops, which matters once mods exist.

**Rules out:** cards written as free-form functions that call the UI or wait for input; random numbers or dates inside rules; a second copy of the rules anywhere in the client or the AI.

## 2. State is split by who may see it; only views leave the host

Game state has three compartments: **public** (everyone), **private** (one per side, including that side's own unrevealed simultaneous picks) and **secret** (only the host: deck order, including both outcome decks, and random-number state). Clients, the AI and spectators only ever receive a **view** built from the compartments that viewer is allowed to see.

**Why.** Both reviews rank hidden-information leaks as a top risk. Filtering fields out of one big state object fails the day an agent adds a field and forgets to filter it. If every field must live in a compartment, "who can see this?" is answered once, when the field is created, and the type checker enforces it.

**How it works**

- `viewFor(state, viewer)` returns the public compartment, the viewer's own private compartment, and **counts** for everything hidden (deck size, opponent hand size).
- Viewers are side A, side B, `spectator` (public only) and `omniscient` (everything, used only for replays of finished games).
- The opponent's hand is a number, never a list of placeholder IDs. Stable placeholders can leak which card was drawn when.
- Each side's private compartment includes its **knowledge**: opponent cards it has been shown, for example by a card that reveals a hand. The AI relies on this.
- Events are filtered the same way: the drawer sees "you drew X", everyone else sees "opponent drew a card".
- **Seed commit and reveal**: the host creates a random seed for each game and publishes only its SHA-256 hash. The seed is revealed when the game ends, so anyone can re-run the game and verify every shuffle and outcome draw.

**The reconstruct invariant.** For any state `s` and side `x`: `reconstruct(viewFor(s, x), hiddenPart(s, x))` must equal `s`. The fuzz suite checks this after every step. It proves three things at once: the compartments cover every field, views carry all the public information, and the AI can rebuild complete game states from its own view (Decision 8).

**Spec for agents**

```typescript
type GameState = {
  public: PublicState;                 // board, tracks, discard, removed, modifiers, turn, public stack frames
  private: Record<Side, PrivateState>; // hand, knowledge, own unrevealed picks
  secret: SecretState;                 // deck order, PRNG state
  meta: { ruleset: RulesetId; seedHash: string; seq: number };
};
type PlayerView = { public: PublicState; mine: PrivateState | null; counts: HiddenCounts; meta: PublicMeta };

viewFor(state: GameState, viewer: Side | 'spectator' | 'omniscient'): PlayerView
hiddenPart(state: GameState, viewer: Side): HiddenPart
reconstruct(view: PlayerView, hidden: HiddenPart): GameState
```

- Every new state field goes into exactly one compartment.
- A stack frame that carries hidden data keeps that data in `private` or `secret` and refers to it by ID.
- Only the engine and the match host may use the `GameState` type. The UI works from views and frames only. The AI receives views and may build full states only through `reconstruct`, with hidden cards it guessed itself.
- The fuzz suite serialises every view and fails if it finds the seed or any card ID from the deck or the opponent's hand.

**Rules out:** sending the move log or the seed to anyone during a game; an AI that reads the real state; spectators seeing hands during play.

## 3. One match host runs every game; clients only receive frames

A single `MatchHost` module wraps the engine with everything a match needs: players, clocks, the move log, views and the ruleset stamp. The same module runs in the browser for single-player and tutorial games, and on the server for online games. Clients reach it through one `MatchTransport` interface and receive **frames**.

**Why.** If single-player and online play used different code, the security path (views, validation) would only run online, where bugs are costly. With one host, every local game also tests the online logic. It also makes the backend replaceable: moving to Cloudflare Durable Objects later means writing one new adapter, not rewriting the game.

**How it works**

- A **frame** is everything one viewer needs at one moment: their view, the events since the last frame, the decision waiting for them (if any) and the clock.
- Transports:
  - **Local**: the host runs in the browser. Used for games against the AI, the tutorial and the developer test mode.
  - **Online**: answers go to the server's single write path; new frames arrive by polling, or by Realtime for the active player.
  - **Replay**: reads a finished game's archive.
  - **Later**: a Durable Objects transport, only if Supabase limits ever bite.
- **Live play, spectating and replays render the same frames.** One renderer serves three features.
- Every answer carries the `seq` number it expects. A stale or duplicate answer is rejected, so double taps and two devices racing are harmless.
- When a game ends, the host re-runs it as the `omniscient` viewer and writes a compressed **replay archive**: one frame per step with both hands visible, plus the seed and move log for verification. Replays are recordings, so old games still play back after rules change.
- The developer **test mode** replaces hot-seat pass-and-play in early phases. It uses the Local transport with a switch to view as side A, side B or spectator, so even during development the UI never touches unfiltered state. Consumer pass-and-play can be added later if wanted.

**Spec for agents**

```typescript
interface MatchTransport {
  subscribe(onFrame: (f: Frame) => void): Unsubscribe;
  submit(s: { decisionId: string; expectedSeq: number; value: AnswerValue }): Promise<SubmitResult>;
  resign(): Promise<void>;
}
type Frame = {
  matchId: string; seq: number; viewer: Viewer; ruleset: RulesetId;
  view: PlayerView; events: VisibleEvent[]; decision: Decision | null; clock: ClockView;
};

// MatchHost core: pure functions, no I/O
hostCreate(config: MatchConfig, seed: Seed, now: number): HostResult
hostSubmit(record: MatchRecord, secret: MatchSecret, submission: Submission, now: number): HostResult
type HostResult = { record: MatchRecord; secret: MatchSecret; frames: Record<Viewer, Frame>; effects: HostEffect[] };
type HostEffect = { notify: PlayerId } | { deadlineAt: number } | { finalize: true };
```

- MatchHost core does no I/O. Adapters (browser, Supabase function, later a Durable Object) load and save records and carry out the effects.
- The clock lives here, never in the engine; `now` is always passed in.
- A replay archive is one gzipped JSON file.

**Rules out:** UI code that reads game tables in Supabase directly; separate rules paths for local and online games; replays that re-simulate with whatever engine is current.

## 4. Everything game-specific is data in one schema

Cards, the map, scenarios, the tutorial and mods are JSON data checked by one set of Zod schemas. A card's effect is a small program of typed steps. The engine runs those steps on the resolution stack from Decision 1, so a step that needs a choice simply creates a pending decision.

**Why.** Data cannot run code, so mods are safe on the server and allowed under Apple's rule against downloaded code (2.5.2). Writing the base game in the same format modders use proves the format is good enough. Store-specific wording becomes a data field, not a code change.

**The effect format**

- **Atomic steps**: add or remove influence, move a track, award VP, draw, discard, draw outcome, coup, realign.
- **Choice steps**: choose countries, choose a card, distribute N influence, yes or no. Each becomes a pending decision.
- **Control steps**: if/else on conditions, and for-each over a finite set. No recursion and no open-ended loops.
- **Modifiers**: rule changes with a scope and a duration, such as "ops values minus 1, minimum 1, until end of turn". They are stored in public state.
- **Triggers**: reactions at named hook points, such as "whenever a coup happens in the Middle East".
- **Built-ins**: `builtin:<name>` calls a named function in engine code, for the few cards no data format can express. Mods may call built-ins but never define new ones.

**Hook points are the rules API.** The engine consults active modifiers and triggers only at fixed, documented points: ops value, coup result, placement allowed, scoring, card played, turn end, and so on. Modders can only use hooks that exist. After v1, this list is a public API that must stay compatible.

**Other content**

- **Map**: the topology (countries, regions, adjacency, stability, battlegrounds) is rules data. The SVG artwork is separate presentation data, keyed by country ID.
- **Scenarios**: map, starting setup, deck by era, number of turns and action rounds, when eras enter, and victory conditions picked from a fixed menu. Mod "game modes" are scenarios; new turn structures wait until after v1.
- **Tutorial**: a scenario with a stacked deck, plus a script that limits which answers are allowed and shows coaching text when events fire. It runs on the normal engine through the Local transport.
- **Per-card presentation**: name, rules text, a required historical note, art reference, and optional per-platform **variants** for wording or art. The historical notes support Google Play's exception for educational content; variants let one card be softened for one store. Variants never change rules, or cross-play would break.
- All player-facing text lives in data, even though launch is English-only.

**Spec for agents**

```typescript
type CardDef = {
  id: CardId; era: EraId; ops: number; affiliation: Side | 'neutral';
  flags: { scoring?: true; removeAfterEvent?: true };
  effect: Step[];
  text: {
    name: string; rules: string; history: string; art: ArtRef;
    variants?: Partial<Record<PlatformId, { name?: string; rules?: string; art?: ArtRef }>>;
  };
};
type Step =
  | { op: 'addInfluence'; side: SideRef; where: CountrySelector; amount: Amount }
  | { op: 'choose'; who: SideRef; decision: DecisionSpec; bind: VarName }
  | { op: 'if'; cond: Condition; then: Step[]; else?: Step[] }
  | { op: 'forEach'; over: FiniteSelector; bind: VarName; do: Step[] }
  | { op: 'modifier'; mod: ModifierSpec; duration: Duration }
  | { op: 'trigger'; hook: HookId; filter?: Condition; do: Step[]; duration: Duration }
  | { op: 'builtin'; name: BuiltinName; args?: Json };
  // plus the other atomic steps
```

- The content bundle is hashed in a canonical form, and the hash is part of the ruleset ID. Any mod changes the hash, so modded games are automatically unranked.
- Every card ships with at least one test that plays it and checks the result.
- Mods are checked by the same schemas on client and server, with size limits and the engine's step budget.
- Names, map layout and terminology are original. "Twilight Struggle" never appears in content or store metadata.

**Rules out:** Lua or JavaScript scripting for mods; card logic inside UI code; rules that differ by platform.

## 5. The server is a thin Supabase adapter with one way to change a game

Supabase Pro hosts accounts, data and exactly one write path for games: the `submit` edge function, which runs MatchHost (Decision 3) and saves the result in one transaction. Everything else clients do with game data is a read, guarded by row-level security.

**Why.** The likeliest security hole is a database read rule that is too broad. With one writer and tables split by visibility, the rules are short enough to check. The same split keeps storage small and keeps the move to another backend cheap.

**Tables**

| Table | Holds | Who can read it |
|---|---|---|
| `match` | players, status, ruleset, clock, deadline, seed hash, `seq` | players and spectators |
| `match_secret` | full game state, seed, move log | nobody (server only; no read rules at all) |
| `match_view` | latest frame per viewer: side A, side B, spectator | that player; the spectator row is public |
| `match_event` | visible events per step, tagged by viewer | the matching viewer |
| `profile`, `rating` | name, Glicko-2 rating, results by side | everyone |
| `entitlement` | account, platform, source, receipt reference | the owner |
| `seek` | matchmaking tickets: rating, deadline preset, side preference | the owner |
| `notify_queue` | pending notifications | server only |

`submit` updates `match` only `where seq = expectedSeq`, so two simultaneous answers cannot both succeed.

**Scheduled jobs (every minute)**

- **Deadlines**: for every match past its deadline, apply that match's deadline rule (see Product calls). Ranked matches always use loss on time: submit a Timeout system action.
- **Matchmaking**: pair compatible tickets, widening the rating band the longer a ticket waits. Tickets persist, so players can close the app and get notified when a game starts.
- **Notifications**: skip push if the player was active in the last 60 seconds. Email only if the turn is still unseen after about 20 minutes, plus one warning near the deadline.
- **Finalize** (when a game ends): update Glicko-2 ratings and results by side, write the replay archive to storage, then delete the bulky rows.

**Accounts and purchases**

- Sign-in methods: 6-digit email codes (not magic links, which open in the system browser instead of the app), Sign in with Apple, Google, and Steam. For Steam, an edge function checks the Steam session ticket and issues a Supabase session.
- Account deletion inside the app.
- Login and notification emails go through a paid email provider (Resend Pro or similar). Resend's free tier stops at 100 emails a day, which would lock players out on a busy day.
- `entitlement` rows come only from verified sources: Steam ownership checks, App Store and Google Play receipts, web merchant-of-record webhooks, and gift codes. Creating an online match, or joining a ranked one, requires an entitlement for the platform being played on. A player without one may join a private game they were invited to by a player who has one.

**Ruleset compatibility window**

- **Before v1**: one ruleset at a time. A rules change wipes games, and old clients see "update required".
- **After v1**: the server supports the current and the previous ruleset. New matches use the newest ruleset that every platform has shipped, because App Store review can lag the web by days. A match always finishes on the ruleset it started with.

**Rules out:** any client write to game tables; Realtime subscriptions for spectators (they poll, which avoids Supabase Pro's 500-connection limit); finished games kept in Postgres.

## 6. The UI only renders frames, and is designed phone-first

The React app draws whatever the current frame says and sends answers back; it contains no game rules. Each decision kind has exactly one prompt component, and each event kind has exactly one entry for its log line, animation and sound.

**Why.** A UI that only renders frames cannot leak hidden information or drift from the rules. The one-entry-per-kind maps are checked by the type checker, so a new decision or event kind breaks the build until the UI handles it. That catches the omissions agents tend to make.

**How it works**

- **State**: one small store (Zustand) holds the latest frame plus local UI state, such as zoom level and a half-built answer.
- **Staged answers**: the player builds a compound answer locally, for example placing four influence with free undo, then confirms once. Live cost previews use pure helper functions the engine exports for public data. The server re-checks everything.
- **Type-checked maps**: `decisionPrompts: Record<DecisionKind, PromptComponent>` and `eventPresentation: Record<EventKind, { log; animate?; sound? }>`.
- **Animation and sound come from events**, never from comparing two states.
- **The map, designed for phones first** (844×390 landscape, then scaled up):
  - Zoomed out, each country is a badge showing net influence in its controller's colour.
  - Zoomed into a region, countries expand into full boxes with stability, both influence numbers and large tap targets.
  - A country list view is an alternative to tapping the map.
  - The hand sits in a bottom sheet that never permanently covers the map.
  - Pan and zoom move one wrapper with CSS transforms, updated outside React's render cycle. A country re-renders only when its own data changes.
- **Native feel**: no text selection, no browser context menu, safe-area padding, and audio unlocked on the first tap (iOS requires a tap before sound plays).

**Rules out:** rules logic in components; UI code reading anything other than frames; designing a desktop board and shrinking it onto phones later.

## 7. Platform differences sit behind one interface; store shells stay thin

The app talks to a `Platform` interface for everything that differs by device or store, with four implementations: web, Steam (Electron), iOS and Android (Capacitor). Game and UI code never ask which platform they are on; they ask the interface what is available.

**Why.** Store rules become details of one implementation instead of `if (iOS)` checks scattered through the code. For example, the iOS implementation has no web-checkout option at all, so Apple's rule against steering buyers to the web cannot be broken by accident.

**Spec for agents**

```typescript
interface Platform {
  id: 'web' | 'steam' | 'ios' | 'android';
  auth: { methods: AuthMethod[]; signIn(m: AuthMethod): Promise<Session> };
  purchases: { unlock(): Promise<PurchaseResult>; restore(): Promise<void>; redeemCode?(code: string): Promise<void> };
  push?: { register(): Promise<PushToken> };   // ask only when the player joins a first online game
  haptics?: { tap(kind: HapticKind): void };
  share(link: ShareLink): Promise<void>;
  storage: KeyValueStore;                      // local saves, settings, guest profile
  steam?: { unlockAchievement(id: string): void; overlayAvailable(): boolean };
}
```

**Shell rules**

- Every shell bundles the built app. Nothing loads the game from a website, so single-player and the tutorial work offline (Apple guideline 4.2).
- **Electron**: context isolation stays on. Steamworks runs in the main process behind a small preload bridge. The overlay is optional, and Steam Deck launch flags are set from the start.
- **Capacitor**: version 8.5 or newer for iOS 27 scene support; Android target API 36. Native push, haptics, in-app purchase and the share sheet.
- **iOS builds** run on a cloud Mac (Codemagic or GitHub Actions macOS runners), because uploads need Xcode 26 and Xcode only runs on macOS.
- **Version check**: each build carries its ruleset ID, asks the server on start whether it is still supported, and shows "update required" if not.
- **Guest mode**: the AI and the tutorial work with no account. Sign-in is requested only when going online.
- **Free copies**: Steam keys; Apple offer codes and Google Play promo codes for the unlock purchase; gift codes on the web.

**Rules out:** platform checks inside game or UI code; a shell that loads the app from a URL; browsable mods or chat on mobile before moderation tools exist.

## 8. The AI is a player that sees only its own view

The AI runs in a Web Worker, receives the same frame a human player would, and returns an answer. It never sees the real game state. For deeper play it guesses hidden cards consistent with what it knows, rebuilds full states with `reconstruct` (Decision 2), and simulates them with the real engine.

**Why.** Fairness is guaranteed by construction, which matters because players suspected Playdek's AI of cheating. Because it simulates with the real engine, modded cards work without hand-written AI. Running on the device costs nothing and works offline.

**Difficulty tiers (targets to tune, not promises)**

| Tier | Method | Time budget |
|---|---|---|
| Easy | Score each legal answer with the evaluation function, plus random noise | under 200 ms |
| Medium | Same scoring, plus tracking which cards are still unseen (scoring-card timing, tension-track safety) | under 500 ms |
| Hard | Guess about 20 possible hidden hands; simulate the best 8 candidate answers a few action rounds ahead | 1 to 2 s |
| Expert | Hard with more guesses and deeper search; can ship labelled beta | 3 to 5 s |

**How it is built**

- The evaluation function's weights are data. Tiers and AI "personalities" are weight files, not separate code.
- For compound decisions, such as placing four influence, the AI builds its answer one unit at a time, the way the UI does.
- An **arena** script plays thousands of AI-vs-AI games with the real engine and reports win rates by tier and by side.
- Gates: Medium beats Easy in over 75% of games, Hard beats Medium in over 65%, and no tier loses to its own tension-track blunder.
- Search stops at its time budget and returns its best answer so far, so a cheap phone gets a weaker but still prompt Hard AI.
- A CI performance test fails if the engine falls below a set number of simulated games per second.
- Build Easy early: it is your first playtest partner and the sensible opponent in the fuzz suite.

**Rules out:** server-side AI; machine-learning models that break whenever cards change; AI code reading the real game state.

## Guardrails: the repository enforces the architecture

You can't review code line by line, so the repository must reject code that breaks these decisions before it lands. A quick subset of checks runs before each commit; the full set runs in CI on every push.

**Repository layout** (one repo, pnpm workspaces)

| Package | Contains | May import |
|---|---|---|
| `engine` | rules, PRNG, views, reconstruct | nothing outside itself |
| `content` | cards, map, scenarios, tutorial, schemas | `engine` types |
| `host` | MatchHost core | `engine`, `content` |
| `ai` | evaluation, search, worker entry | `engine`, `content` |
| `app` | React UI, transports, the Platform interface | `engine` types and public helpers, `host`, `ai` (as a worker) |
| `server` | Supabase functions, SQL migrations, jobs | `engine`, `content`, `host` |
| `shells/steam`, `shells/mobile` | wrappers and Platform implementations | `app` |
| `tools` | arena, fuzz runner, content validator | anything |

**Automatic checks**

- TypeScript strict mode, a linter, and a boundary checker (such as dependency-cruiser) that enforces the import column above.
- **Fuzz suite** (fast-check): thousands of games with random and Easy-AI players. After every step it checks that:
  1. while a game is active, someone always has a legal answer;
  2. no influence is negative and every track stays in range;
  3. deck, hands, discard, removed and in-play cards always add up to the full card set;
  4. no view contains the seed or a hidden card ID;
  5. `reconstruct` rebuilds the exact state (Decision 2);
  6. replaying the move log from the start gives an identical state.
- **Golden replays**: saved games that must reproduce exactly. They are updated only on purpose, when rules change.
- **Per-card tests**: every card has at least one.
- **Type-checked UI maps** (Decision 6) fail the build when a decision or event kind is missing.
- **Playwright** smoke tests at phone and desktop sizes, including a full offline tutorial run.
- **Engine speed floor** for the AI (Decision 8).
- Any source file over about 350 lines gets split.

**Working with agents**

- `CLAUDE.md` and `GEMINI.md` carry the rules in the last section of this doc.
- A second agent reviews each change against this document before you merge it.
- Every change ends with a plain-English summary of what behaviour changed. You approve behaviour, not code.

## Coverage: every issue and where it is handled

Every development issue raised so far maps to at least one decision; none is left unowned. "Claude" and "Gemini" are the two research reports, "comparison" is the cross-check, and "new" means it surfaced while designing this doc.

| Issue | Raised by | Handled by |
|---|---|---|
| Cards pause mid-resolution for the other player | Both | 1 |
| Simultaneous secret picks (headline phase) | New | 1, 2 |
| Deterministic, verifiable replays | Both | 1, 3 |
| Long async games crossing a rules patch | Gemini, extended in comparison | 3, 5 |
| Version stamp and "update required" check | Your decision | 1, 7 |
| Deck, opponent hand or seed reaching a client | Both | 2, 5 |
| Placeholder card IDs leaking draw order | New | 2 |
| Provably fair shuffles and outcome draws | Claude | 2 |
| Spectators seeing hands | Both | 2, 3 |
| AI peeking at hidden cards | Both | 2, 8 |
| Two answers submitted at once | Claude | 3, 5 |
| Turn deadlines and timeouts | Both | 1, 3, 5 |
| Complex cards a simple effect list can't express | Both | 4 |
| Mod security and server validation | Both | 4 |
| Apple 2.5.2: no downloaded code | Both | 4 |
| Runaway trigger loops in mods | New | 1, 4 |
| Real governments, terrorism and recent events in store review | Both | 4; content calls in Product calls |
| Original names; no "Twilight Struggle" in metadata | Claude | 4 |
| Interactive tutorial | Both | 3, 4 |
| Supabase free tier pauses after 7 days | Both | 5 |
| Supabase Realtime 500-connection limit | Both | 5 |
| Storage growth against one-time revenue | Both | 3, 5 |
| Moving off Supabase later | Both | 3, 5 |
| Resend free tier's 100-emails-a-day cap | Comparison | 5 |
| Notification spam; when to ask for push permission | Gemini | 5, 7 |
| Magic links breaking inside wrapped apps | Gemini | 5 |
| Sign in with Apple or equivalent; in-app account deletion | Both | 5, 7 |
| Matchmaking with few players online | Gemini | 5 |
| Ratings and side imbalance | Both | 5 (bidding after v1) |
| Entitlements and free copies | Both | 5, 7 |
| Store review lag leaving platforms on different builds | New | 5 |
| World map on a phone screen | Both | 6 |
| Smooth pan and zoom on phones | Gemini | 6 |
| Online play feeling slow (one round trip per influence point) | New | 1, 6 |
| Agents forgetting to handle new UI cases | New | 6 |
| Apple 4.2: minimum functionality for wrapped apps | Both | 7 |
| Steering buyers to web checkout from mobile | Both | 7 |
| iOS builds from a Windows PC | Gemini | 7 |
| Capacitor iOS 27 scenes; Android target API 36 | Claude | 7 |
| Electron security, Steam overlay, Steam Deck | Claude | 7 |
| User-generated content rules for mods and chat on mobile | Both | 7 |
| AI too easy; need real difficulty levels | Both | 8 |
| AI on cheap phones | Claude | 8 |
| AI handling modded cards | Gemini | 8 |
| Agent drift and tangled code | Both | Guardrails |
| Pass-and-play letting the UI read full state | Gemini | 3 |
| First slice covering every mechanic type | Gemini | Build order |
| Legal review before launch | Claude | Product calls |

## Product calls

Nine choices were yours, and each changes something in the design. All nine were decided on 2026-10-16. Four differ from the earlier recommended default; they are marked "changed".

| Question | Decision | What it changes |
|---|---|---|
| Mobile pricing | Free download with a one-time "Full Game" unlock | Entitlements, free-copy codes |
| What can players do before unlocking? | **Changed.** Tutorial, spectating, replays, and the first era against the AI, plus joining a private game when invited by a player who owns the game. Free players cannot create online games or play ranked. | Entitlement checks in the match host |
| What happens when a deadline passes? | **Changed.** Whoever sets up a private game picks one of three rules: loss on time; one grace extension, then loss on time; or the AI plays the missed turn. Ranked always uses loss on time. Open point: Decision 8 rules out server-side AI, so how the AI plays a missed online turn still needs deciding. | Deadline job, lobby settings, possibly Decision 8 |
| Keep a headline-style simultaneous phase? | Yes | Simultaneous decisions in the engine |
| Undo | Free undo while building an answer; none after confirming | Staged answers in the UI |
| Recent events (2022 on) and the post-2026 "future" | **Changed.** The base game runs 1991–2025. The years 2025–2027 are an optional scenario; future cards name roles, not people. | Content, per-store variants |
| How terrorism works | **Changed.** Not a mechanic, force or separate system. Terrorism appears only as the historical subject of some event cards (for example September 11, 2001), because it was prominent in the period. | Card design, store approval; no terrorism mechanic to design |
| Steam accounts | Steam players sign in through Steam automatically and can add email later | Auth |
| Legal review | One review by a games/IP lawyer before the first store submission | Content, store metadata |

## Revised build order

Guardrails come first and the engine is proven on a 25-card slice before any server work. Each phase ends at a gate that must pass before the next starts.

1. **Foundations.** Repo, workspaces, CI, boundary checker, `CLAUDE.md` and `GEMINI.md`, an empty engine with the three compartments, and the fuzz harness.
   - Gate: CI passes on an empty game loop.
2. **Engine and a 25-card slice.** Resolution stack, decisions (including simultaneous ones), modifiers, triggers, views, `reconstruct`, PRNG, seed commit and reveal; the map and 25 cards covering every mechanic type.
   - Gate: 10,000 fuzz games with zero invariant failures.
3. **Match host, test mode and a phone-first UI.** Local transport, frame renderer, decision prompts, the semantic-zoom map, Easy AI.
   - Gate: someone new finishes a 25-card game on a phone-sized screen without help.
4. **Online async on the web.** Supabase Pro, `submit`, tables and read rules, deadlines, invite codes, email sign-in codes, email turn alerts, replay archive.
   - Gate: 50 online games with no desyncs and no hidden data visible in browser network traffic.
5. **Full content and single-player.** All eras, Medium and Hard AI, the arena, tutorial, audio, spectating. Consider an early TestFlight submission here to test Apple's reaction to the content.
   - Gate: arena win-rate targets met; the tutorial passes offline.
6. **Public web beta and sales.** Glicko-2, matchmaking, web checkout, gift codes, results by side.
   - Gate: stable play and enough data to judge side balance.
7. **Steam.** Electron shell, Steamworks, Steam sign-in, Steam Playtest including a Steam Deck test. Request keys no earlier than 3 weeks after creating the app ID.
8. **Android, then iOS.** Capacitor shells, native push, in-app purchase, haptics, cloud Mac builds, the Google Play content questionnaire, App Store review.
9. **After v1.** Freeze version 1 of the effect format and the hook list; turn on the ruleset compatibility window; private modded lobbies on web and Steam (Steam Workshop); replay export for tournaments; quick-chat phrases, then friend-only text chat.

## Agent rules for CLAUDE.md and GEMINI.md

Paste this block into both files at the repository root, and save this whole doc as `docs/architecture.md` (it exports to Markdown).

```markdown
# Terminal Dusk: rules for coding agents

Read docs/architecture.md before changing code. If a task conflicts with it, stop and ask.

## Boundaries
- packages/engine imports nothing outside itself: no React, Supabase, DOM, Date, Math.random, timers or network.
- Only engine and host code may use the GameState type. UI code works from frames; AI code from views, plus reconstruct().
- UI code contains no game rules. It renders frames and sends answers.
- Only the server submit function writes game state. Clients never write match tables.
- Platform-specific code lives only in Platform implementations.

## Engine
- Every wait for a player is a pending Decision. Never await input inside rules.
- State is plain JSON, integers only, with explicit ordering. apply() never mutates its input.
- Every new state field goes in exactly one compartment: public, private[side] or secret.
- A new decision kind or event kind needs its UI prompt or presentation entry; the build fails until it has one.

## Content
- Cards are data checked by the Zod schemas. Use a builtin only when no step type can express the card, and name it after the card.
- Every card needs a test that plays it.
- Platform variants change wording and art only, never rules.

## Process
- Run typecheck, lint, the boundary check and all tests before finishing.
- Never delete, skip or weaken a test to make it pass. Golden replays change only when a rules change is intended, and say so.
- Keep files under about 350 lines; split by responsibility.
- Don't add a dependency without saying why.
- End every task with a plain-English summary of what behaviour changed.
```
