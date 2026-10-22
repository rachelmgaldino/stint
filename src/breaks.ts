// Short or long break: once enough focus has piled up since the last long
// break today, the next break is a long one. Pure, so it can be tested.

import { startOfDay } from "./dates";
import type { SessionRecord, Settings } from "./store";

const MIN = 60_000;

export type NextBreak = { minutes: number; long: boolean };

/** A break that lasted (or was planned for) the long length counts as long. */
function wasLong(s: SessionRecord, longMs: number): boolean {
  return s.kind === "break" && (s.plannedMs >= longMs || s.endedAt - s.startedAt >= longMs);
}

/**
 * Focus time since the last long break today, plus `extraMs` not saved yet.
 * Sessions from before `now`'s midnight are left out: Stint stays open in the
 * tray overnight, so the list it holds can still be yesterday's.
 */
export function focusSinceLongBreak(sessions: SessionRecord[], settings: Settings, extraMs = 0, now = Date.now()): number {
  const longMs = settings.longBreakMinutes * MIN;
  const midnight = startOfDay(now);
  const today = sessions.filter((s) => s.startedAt >= midnight);
  const lastLong = today.filter((s) => wasLong(s, longMs)).reduce((t, s) => Math.max(t, s.endedAt), 0);
  return today
    .filter((s) => s.kind === "focus" && s.startedAt >= lastLong)
    .reduce((sum, s) => sum + s.focusedMs, extraMs);
}

export function nextBreak(today: SessionRecord[], settings: Settings, extraMs = 0, now = Date.now()): NextBreak {
  const long = focusSinceLongBreak(today, settings, extraMs, now) >= settings.longBreakAfter * MIN;
  return { minutes: long ? settings.longBreakMinutes : settings.breakMinutes, long };
}
