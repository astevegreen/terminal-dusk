// The match host's own types (docs/architecture.md, Decision 3). The host's Frame is what one viewer
// receives; the engine's type of the same name is a resolution-stack frame, a different thing.
import type {
  Answer,
  AnswerValue,
  Decision,
  OmniscientView,
  EngineErrorCode,
  GameEvent,
  GameState,
  GameStatus,
  PlayerView,
  RulesetId,
  Seed,
  Setup,
  Side,
  Viewer,
} from "@terminal-dusk/engine";

export type PlayerId = string;

/** What happens when a side misses its deadline: it loses on time, or first gets one extension of the same length. */
export type DeadlineRule = "lossOnTime" | "graceThenLoss";
/** A match's deadline rule and how many days each side has to answer each decision. */
export type MatchDeadline = { rule: DeadlineRule; days: 1 | 3 | 7 };

/**
 * Who plays each side, and the setup to start from. The host adds the seed's fingerprint.
 * Without `deadline` the match has no deadlines (local and practice games).
 */
export type MatchConfig = {
  matchId: string;
  players: Record<Side, PlayerId>;
  setup: Omit<Setup, "seedHash">;
  deadline?: MatchDeadline;
};

/**
 * A match's clock. `deadlines[side]` is the time (whole milliseconds) by which `side` must answer, or
 * null when the game is not waiting on it. `graceUsed[side]` is true once `side` has had its extension.
 */
export type MatchClock = MatchDeadline & {
  deadlines: Record<Side, number | null>;
  graceUsed: Record<Side, boolean>;
};

/** What players and spectators may read (the `match` table). Nothing hidden, and no Contingency data. */
export type MatchRecord = {
  matchId: string;
  players: Record<Side, PlayerId>;
  ruleset: RulesetId;
  seedHash: string;
  /** Absent while the game is active; the game's seed once it is over, so anyone can re-check it. */
  seed?: Seed;
  seq: number;
  status: GameStatus;
  createdAt: number;
  updatedAt: number;
  /** Present exactly when the match was set up with a deadline. */
  clock?: MatchClock;
};

/** What only the host may read (the `match_secret` table). `log` holds the answers, oldest first. */
export type MatchSecret = { seed: Seed; setup: Setup; state: GameState; log: Answer[] };

/** Everything one viewer needs at one moment: its view, the events it may see and its waiting decision. */
export type Frame = {
  matchId: string;
  seq: number;
  viewer: Viewer;
  ruleset: RulesetId;
  view: PlayerView;
  events: GameEvent[];
  decision: Decision | null;
};

/** What a player sends: an answer to a waiting decision (with the seq it expects), or a resignation. */
export type Submission =
  | { player: PlayerId; expectedSeq: number; decisionId: string; value: AnswerValue }
  | { player: PlayerId; resign: true };

/**
 * Something the adapter must do after a host call. `notify`: tell this player a decision waits.
 * `deadlineAt`: the earliest time the deadline rule may need applying (call hostDeadline then).
 */
export type HostEffect = { notify: PlayerId } | { deadlineAt: number } | { finalize: true };

export type HostResult = {
  record: MatchRecord;
  secret: MatchSecret;
  frames: Record<Viewer, Frame>;
  effects: HostEffect[];
};

export type HostErrorCode =
  | "invalidConfig"
  | "invalidTime"
  | "notPlayer"
  | "staleSeq"
  | "verifyFailed"
  | "gameNotOver"
  | "notDue"
  | "pastDeadline"
  | "notEntitled";
export type HostError = { code: EngineErrorCode | HostErrorCode; message?: string };
export type HostOutcome = { ok: true; value: HostResult } | { ok: false; error: HostError };

/** One step of a replay: its seq, the omniscient view after it, and the events it produced (as that viewer sees them). */
export type ReplayFrame = { seq: number; view: OmniscientView; events: GameEvent[] };

/** A finished game as plain data: one frame per step, plus the seed and move log so anyone can verify it. */
export type ReplayArchive = {
  matchId: string;
  ruleset: RulesetId;
  players: Record<Side, PlayerId>;
  seedHash: string;
  seed: Seed;
  setup: Setup;
  log: Answer[];
  status: GameStatus;
  frames: ReplayFrame[];
};
