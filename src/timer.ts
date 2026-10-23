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
      /** Flow: counts up with no planned end. endsAt and plannedMs mean nothing then. */
      flow?: boolean;
    }
  | {
      status: "paused";
      kind: Kind;
      startedAt: number;
      remainingMs: number;
      plannedMs: number;
      pausedMs: number;
      pausedAt: number;
      flow?: boolean;
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

/** A focus session in flow: it counts up from now until it's ended, with no planned length. */
export function startFlow(now: number): Timer {
  return { status: "running", kind: "focus", startedAt: now, endsAt: now, plannedMs: 0, pausedMs: 0, flow: true };
}

/** True for a running or paused flow session. */
export function isFlow(t: Timer): boolean {
  return t.status !== "idle" && !!t.flow;
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
    ...(t.flow ? { flow: true } : {}),
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
    ...(t.flow ? { flow: true } : {}),
  };
}

/**
 * Milliseconds left. Negative once the timer has run past its end (overtime).
 * Infinity in flow, which never ends on its own.
 */
export function remaining(t: Timer, now: number): number {
  if (t.status !== "idle" && t.flow) return Infinity;
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
 * How hot the mascot gets from a long focus: 0 up to one hour, 1 (warm) past
 * one hour, 2 (overheating) past two. A nudge to take a break.
 */
export function heatFor(minutes: number): Heat {
  return minutes > 120 ? 2 : minutes > 60 ? 1 : 0;
}

/**
 * The heat of a running focus session: the time focused so far, so the
 * mascot starts calm and tires as the session goes on, overtime included.
 * While picking a length, use heatFor(planned minutes) instead.
 */
export function heat(t: Timer, now: number): Heat {
  if (t.status === "idle" || t.kind !== "focus") return 0;
  return heatFor(elapsed(t, now) / 60_000);
}

/**
 * Add or remove time from a running or paused timer. The remaining time never
 * drops below one minute, so scrubbing can't end a session by accident.
 */
export function scrub(t: Timer, deltaMs: number, now: number): Timer {
  if (t.status === "idle" || t.flow) return t;
  const left = remaining(t, now);
  const target = Math.max(60_000, left + deltaMs);
  const applied = target - left;
  const plannedMs = Math.max(60_000, t.plannedMs + applied);
  if (t.status === "running") return { ...t, endsAt: t.endsAt + applied, plannedMs };
  return { ...t, remainingMs: t.remainingMs + applied, plannedMs };
}

/**
 * Say the session really began at `startedAt` (usually earlier, when the timer
 * was started late). The planned length stays, so the end moves by the same
 * amount and the session may land in overtime. The start can't move past the
 * point where no time would be left in the session.
 */
export function moveStart(t: Timer, startedAt: number, now: number): Timer {
  if (t.status === "idle") return t;
  const latest = (t.status === "paused" ? t.pausedAt : now) - t.pausedMs;
  const delta = Math.min(startedAt, latest) - t.startedAt;
  if (t.status === "running") return { ...t, startedAt: t.startedAt + delta, endsAt: t.endsAt + delta };
  return { ...t, startedAt: t.startedAt + delta, remainingMs: t.remainingMs + delta };
}

/** Fraction of the planned time that has passed, clamped to 0..1. */
export function progress(t: Timer, now: number): number {
  if (t.status === "idle" || t.flow || t.plannedMs <= 0) return 0;
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

/**
 * Minutes from what someone types for a length: "90", "90m", "1:30", "1h30",
 * "1h 30m", "1.5h", "1,5h" or "2h". Null when it can't be read.
 */
export function parseDuration(text: string): number | null {
  const s = text.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  let m = /^(\d{1,4})(m|min)?$/.exec(s);
  if (m) return Number(m[1]);
  m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (m) return Number(m[2]) > 59 ? null : Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d{1,2})h(?:(\d{1,2})(?:m|min)?)?$/.exec(s);
  if (m) return m[2] !== undefined && Number(m[2]) > 59 ? null : Number(m[1]) * 60 + Number(m[2] ?? 0);
  m = /^(\d{1,2})[.,](\d{1,2})h$/.exec(s);
  if (m) return Math.round(Number(`${m[1]}.${m[2]}`) * 60);
  return null;
}

/** "1h 25m", "25m", "0m". */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
