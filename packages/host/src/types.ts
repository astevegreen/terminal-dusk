// The match host's own types (docs/architecture.md, Decision 3). The host's Frame is what one viewer
// receives; the engine's type of the same name is a resolution-stack frame, a different thing.
import type {
  Answer,
  AnswerValue,
  Decision,
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

/** Who plays each side, and the setup to start from. The host adds the seed's fingerprint. */
export type MatchConfig = { matchId: string; players: Record<Side, PlayerId>; setup: Omit<Setup, "seedHash"> };

/** What players and spectators may read (the `match` table). Nothing hidden, and no Contingency data. */
export type MatchRecord = {
  matchId: string;
  players: Record<Side, PlayerId>;
  ruleset: RulesetId;
  seedHash: string;
  seq: number;
  status: GameStatus;
  createdAt: number;
  updatedAt: number;
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

/** Something the adapter must do after a host call. `notify`: tell this player a decision waits. */
export type HostEffect = { notify: PlayerId };

export type HostResult = {
  record: MatchRecord;
  secret: MatchSecret;
  frames: Record<Viewer, Frame>;
  effects: HostEffect[];
};

export type HostErrorCode = "invalidConfig" | "invalidTime" | "notPlayer" | "staleSeq";
export type HostError = { code: EngineErrorCode | HostErrorCode; message?: string };
export type HostOutcome = { ok: true; value: HostResult } | { ok: false; error: HostError };
