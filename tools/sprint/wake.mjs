// While a usage limit is on, a scheduled supervisor run fails before it starts, so lanes it stopped would wait for
// the next hourly run. Each supervisor run moves one standing one-shot of itself, "TD sprint supervisor wake", to
// 2 minutes after the limit resets (`get_session`'s rate_limit_info.resetsAt), unless the hourly run comes soon
// enough anyway. This decides whether and when; the supervisor makes or moves the trigger.
export const SUPERVISOR_MINUTE = 2;
// The hourly run "covers" a wake that would land up to this many minutes before it.
const COVER_MINUTES = 15;

const minuteIso = (ms) => new Date(ms).toISOString().replace(/:\d{2}\.\d{3}Z$/, "Z");

/**
 * { wake, arm, runOnceAt?, reason, log? } for the window on record `w` ({start, end, wake}) at `now`, given the
 * reset in epoch seconds (a string from the command line, or undefined when get_session gave none).
 */
export function wakePlan(w, now, resetsAt) {
  const base = { wake: w?.wake ?? null };
  const open = w?.start && w?.end && now >= new Date(w.start) && now < new Date(w.end);
  if (!open) return { ...base, arm: false, reason: "no window is open" };
  if (!/^\d+$/.test(String(resetsAt ?? "")))
    return {
      ...base,
      arm: false,
      reason: "no resetsAt",
      log: "no usage-limit reset time in get_session, so no wake is armed this run",
    };
  const at = Math.ceil((Number(resetsAt) * 1000 + 120000) / 60000) * 60000;
  if (at <= now.getTime()) return { ...base, arm: false, reason: "the reset has passed" };
  if (at >= new Date(w.end).getTime()) return { ...base, arm: false, reason: "the reset falls after the window ends" };
  const minute = new Date(at).getUTCMinutes();
  // Minutes until the next hourly run, wrapping past the hour: at minute 2, a wake at :50 or :01 is covered.
  if ((SUPERVISOR_MINUTE - minute + 60) % 60 <= COVER_MINUTES)
    return { ...base, arm: false, reason: `the hourly run at :0${SUPERVISOR_MINUTE} covers ${minuteIso(at)}` };
  const reason = base.wake ? "move the wake" : "create the wake, then record it with window ids --wake";
  return { ...base, arm: true, runOnceAt: minuteIso(at), reason };
}
