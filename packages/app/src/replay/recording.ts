// What the app is allowed to hold of a finished game: the frames and the final status, but never the archive's
// seed, setup or move log (CLAUDE.md, Never). Only the Local transport sees a ReplayArchive.
import type { GameStatus } from "@terminal-dusk/engine";
import type { ReplayArchive, ReplayFrame } from "@terminal-dusk/host";

export type ReplayRecording = {
  matchId: string;
  seedHash: string;
  status: GameStatus;
  frames: ReplayFrame[];
};

/** Copies only the safe fields of an archive. */
export function toRecording(archive: ReplayArchive): ReplayRecording {
  return {
    matchId: archive.matchId,
    seedHash: archive.seedHash,
    status: archive.status,
    frames: archive.frames,
  };
}
