// Short or long break: once enough focus has piled up since the last long
// break today, the next break is a long one. Pure, so it can be tested.

import type { SessionRecord, Settings } from "./store";

const MIN = 60_000;

export type NextBreak = { minutes: number; long: boolean };

/** A break that lasted (or was planned for) the long length counts as long. */
function wasLong(s: SessionRecord, longMs: number): boolean {
  return s.kind === "break" && (s.plannedMs >= longMs || s.endedAt - s.startedAt >= longMs);
}

/** Focus time since the last long break among `today`, plus `extraMs` not saved yet. */
export function focusSinceLongBreak(today: SessionRecord[], settings: Settings, extraMs = 0): number {
  const longMs = settings.longBreakMinutes * MIN;
  const lastLong = today.filter((s) => wasLong(s, longMs)).reduce((t, s) => Math.max(t, s.endedAt), 0);
  return today
    .filter((s) => s.kind === "focus" && s.startedAt >= lastLong)
    .reduce((sum, s) => sum + s.focusedMs, extraMs);
}

export function nextBreak(today: SessionRecord[], settings: Settings, extraMs = 0): NextBreak {
  const long = focusSinceLongBreak(today, settings, extraMs) >= settings.longBreakAfter * MIN;
  return { minutes: long ? settings.longBreakMinutes : settings.breakMinutes, long };
}
