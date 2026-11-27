// The words about the check of what the player owns (#686), drawn on the home screen and the side picker: that it is
// running, or that it failed, with a button to try again. Nothing is drawn otherwise.
import type { EntitlementSnapshot } from "./session.ts";

export const CHECKING = "Checking whether you own the Full Game…";
export const CHECK_FAILED = "Couldn't check whether you own the Full Game.";
export const RETRY = "Try again";

const TAP = { minHeight: 44, minWidth: 44 } as const;

export function EntitlementNotice({
  state,
  known,
  onRetry,
}: Readonly<Pick<EntitlementSnapshot, "state" | "known"> & { onRetry: () => void }>) {
  if (state === "loading") return <p role="status">{CHECKING}</p>;
  if (state !== "failed") return null;
  return (
    <div role="alert">
      <p>
        {CHECK_FAILED} {known ? "Using the last answer." : "Until it can, games against the AI stop after Era 1."}
      </p>
      <button type="button" style={TAP} onClick={onRetry}>
        {RETRY}
      </button>
    </div>
  );
}
