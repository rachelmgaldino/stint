// Short or long break: once enough focus has piled up since the last long
// rest, the next break is a long one. Pure, so it can be tested.

import type { SessionRecord, Settings } from "./store";

const MIN = 60_000;

export type NextBreak = { minutes: number; long: boolean };

/** Saved sessions, and the one just ended before it is saved. */
type Session = Omit<SessionRecord, "id">;

/**
 * Focus time since the last long rest. A long rest is a break planned at the
 * long length, or time away from focus at least that long: breaks and time with
 * no timer running count together, so a short break that ran long is one, and
 * so is a night away.
 */
export function focusSinceLongBreak(sessions: Session[], settings: Settings, now = Date.now()): number {
  const longMs = settings.longBreakMinutes * MIN;
  let sum = 0;
  // Newest first. `next` is when the focus after this one started (now for the newest).
  let next = now;
  for (const s of [...sessions].sort((a, b) => b.startedAt - a.startedAt)) {
    if (s.kind === "break") {
      if (s.plannedMs >= longMs) break;
      continue;
    }
    if (next - s.endedAt >= longMs) break;
    sum += s.focusedMs;
    next = s.startedAt;
  }
  return sum;
}

export function nextBreak(sessions: Session[], settings: Settings, now = Date.now()): NextBreak {
  const long = focusSinceLongBreak(sessions, settings, now) >= settings.longBreakAfter * MIN;
  return { minutes: long ? settings.longBreakMinutes : settings.breakMinutes, long };
}
