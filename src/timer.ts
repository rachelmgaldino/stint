// Pure timer state. Times are wall-clock milliseconds so the timer stays
// accurate even if the window is hidden and JS timers get throttled.

export type Kind = "focus" | "break";

export type Timer =
  | { status: "idle" }
  | {
      status: "running";
      kind: Kind;
      startedAt: number;
      endsAt: number;
      plannedMs: number;
      pausedMs: number;
    }
  | {
      status: "paused";
      kind: Kind;
      startedAt: number;
      remainingMs: number;
      plannedMs: number;
      pausedMs: number;
      pausedAt: number;
    };

export const idle: Timer = { status: "idle" };

export function start(kind: Kind, durationMs: number, now: number): Timer {
  return {
    status: "running",
    kind,
    startedAt: now,
    endsAt: now + durationMs,
    plannedMs: durationMs,
    pausedMs: 0,
  };
}

export function pause(t: Timer, now: number): Timer {
  if (t.status !== "running") return t;
  return {
    status: "paused",
    kind: t.kind,
    startedAt: t.startedAt,
    remainingMs: t.endsAt - now,
    plannedMs: t.plannedMs,
    pausedMs: t.pausedMs,
    pausedAt: now,
  };
}

export function resume(t: Timer, now: number): Timer {
  if (t.status !== "paused") return t;
  return {
    status: "running",
    kind: t.kind,
    startedAt: t.startedAt,
    endsAt: now + t.remainingMs,
    plannedMs: t.plannedMs,
    pausedMs: t.pausedMs + (now - t.pausedAt),
  };
}

/** Milliseconds left. Negative once the timer has run past its end (overtime). */
export function remaining(t: Timer, now: number): number {
  if (t.status === "running") return t.endsAt - now;
  if (t.status === "paused") return t.remainingMs;
  return 0;
}

/** Time actually spent in the session so far, excluding pauses. */
export function elapsed(t: Timer, now: number): number {
  if (t.status === "running") return now - t.startedAt - t.pausedMs;
  if (t.status === "paused") return t.pausedAt - t.startedAt - t.pausedMs;
  return 0;
}

export type Heat = 0 | 1 | 2;

/**
 * How hot the mascot gets from a long focus: 0 for the first hour, 1 (warm)
 * after one hour, 2 (overheating) after two. A nudge to take a break.
 */
export function heat(t: Timer, now: number): Heat {
  if (t.status === "idle" || t.kind !== "focus") return 0;
  const minutes = elapsed(t, now) / 60_000;
  return minutes > 120 ? 2 : minutes > 60 ? 1 : 0;
}

/**
 * Add or remove time from a running or paused timer. The remaining time never
 * drops below one minute, so scrubbing can't end a session by accident.
 */
export function scrub(t: Timer, deltaMs: number, now: number): Timer {
  if (t.status === "idle") return t;
  const left = remaining(t, now);
  const target = Math.max(60_000, left + deltaMs);
  const applied = target - left;
  const plannedMs = Math.max(60_000, t.plannedMs + applied);
  if (t.status === "running") return { ...t, endsAt: t.endsAt + applied, plannedMs };
  return { ...t, remainingMs: t.remainingMs + applied, plannedMs };
}

/** Fraction of the planned time that has passed, clamped to 0..1. */
export function progress(t: Timer, now: number): number {
  if (t.status === "idle" || t.plannedMs <= 0) return 0;
  const done = 1 - remaining(t, now) / t.plannedMs;
  return Math.min(1, Math.max(0, done));
}

/** "25:00", "1:05:09", or "+3:12" for overtime. */
export function formatClock(ms: number): string {
  const over = ms < 0;
  // Count down by whole seconds the way a kitchen timer does: 24:59.4 shows 25:00.
  const total = over ? Math.floor(-ms / 1000) : Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const body = `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
  return over ? `+${body}` : body;
}

/** "1h 25m", "25m", "0m". */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
