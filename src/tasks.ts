import type { SessionRecord } from "./store";
import * as T from "./timer";

// A focus session can hold several tasks: Next task closes the one being
// worked on at that minute and starts the next while the timer keeps going.
// Each task is saved as its own record, linked to the others by the session's
// start time (partOf), so the day's diary has the exact time spent on each
// while analytics and the calendar still see one session.

/** A task finished earlier in the running session. It began where the one before it ended, or at the session's start. */
export type DoneTask = { intention: string; categoryId: number | null; endedAt: number; focusedMs: number };

const MIN = 60_000;
const total = (done: DoneTask[]) => done.reduce((a, d) => a + d.focusedMs, 0);

/** When the task being worked on now began. */
export function currentTaskStart(timer: T.Timer, done: DoneTask[]): number {
  if (timer.status === "idle") return 0;
  return done.length ? done[done.length - 1].endedAt : timer.startedAt;
}

/** Focus time on the task being worked on now, pauses left out. */
export function currentTaskMs(timer: T.Timer, done: DoneTask[], now: number): number {
  return Math.max(0, T.elapsed(timer, now) - total(done));
}

/** Closes the task being worked on at `at`, adding it to the finished ones. */
export function closeTask(timer: T.Timer, done: DoneTask[], intention: string, categoryId: number | null, at: number): DoneTask[] {
  return [...done, { intention: intention.trim(), categoryId, endedAt: at, focusedMs: currentTaskMs(timer, done, at) }];
}

/**
 * The records to save for a focus session: `session` as is when it had one
 * task, or one record per task, linked by the session's start, when it had more.
 * `session` holds the task worked on last and the whole session's times.
 */
export function taskRecords(session: Omit<SessionRecord, "id">, done: DoneTask[]): Omit<SessionRecord, "id">[] {
  if (session.kind !== "focus" || done.length === 0) return [session];
  const partOf = session.startedAt;
  const out: Omit<SessionRecord, "id">[] = [];
  let start = session.startedAt;
  for (const d of done) {
    // A start moved later than a task's end (the start editor) can't make it run backwards.
    const begin = Math.min(start, d.endedAt);
    out.push({ ...session, intention: d.intention, categoryId: d.categoryId, startedAt: begin, endedAt: d.endedAt, focusedMs: d.focusedMs, partOf });
    start = d.endedAt;
  }
  out.push({ ...session, startedAt: Math.min(start, session.endedAt), focusedMs: Math.max(0, session.focusedMs - total(done)), partOf });
  return out;
}

/** Which session a record belongs to: its tasks share one key. */
export function sessionKey(s: SessionRecord): string {
  return s.partOf != null ? `p${s.partOf}` : `s${s.id}`;
}

/** How many focus sessions the records make, counting a session with several tasks once. */
export function countSessions(list: SessionRecord[]): number {
  return new Set(list.filter((s) => s.kind === "focus").map(sessionKey)).size;
}

/** True when the record carries on from an earlier task in the same session. */
export function isNextTask(s: SessionRecord, list: SessionRecord[]): boolean {
  return s.partOf != null && list.some((o) => o.id !== s.id && o.partOf === s.partOf && o.startedAt < s.startedAt);
}

/** One record per session: the first task of each session with several, and every other record as it is. */
export function firstParts(list: SessionRecord[]): SessionRecord[] {
  return list.filter((s) => !isNextTask(s, list));
}

/** One record per session with its tasks put together: the first one's start, the last one's end, the focus time added up. */
export function joinParts(list: SessionRecord[]): SessionRecord[] {
  const byKey = new Map<string, SessionRecord>();
  for (const s of [...list].sort((a, b) => a.startedAt - b.startedAt)) {
    const key = sessionKey(s);
    const known = byKey.get(key);
    if (!known) byKey.set(key, { ...s });
    else byKey.set(key, { ...known, endedAt: Math.max(known.endedAt, s.endedAt), focusedMs: known.focusedMs + s.focusedMs });
  }
  return [...byKey.values()];
}

/** The tasks of the session `s` belongs to, in order: just `s` when it had one. */
export function partsOf(s: SessionRecord, list: SessionRecord[]): SessionRecord[] {
  if (s.partOf == null) return [s];
  const parts = list.filter((o) => o.partOf === s.partOf && o.kind === s.kind);
  return (parts.some((o) => o.id === s.id) ? parts : [...parts, s]).sort((a, b) => a.startedAt - b.startedAt);
}

/**
 * Moves the switch from task `i - 1` to task `i` to the minute `at`, for a
 * Next task pressed late (or early). The two trade focus time so the
 * session's total stays the same; each keeps at least a minute.
 */
export function moveSwitch<P extends Pick<SessionRecord, "startedAt" | "endedAt" | "focusedMs">>(parts: P[], i: number, at: number): P[] {
  if (i <= 0 || i >= parts.length) return parts;
  const prev = parts[i - 1];
  const cur = parts[i];
  const when = Math.min(Math.max(at, prev.startedAt + MIN), cur.endedAt - MIN);
  if (when <= prev.startedAt || when >= cur.endedAt) return parts;
  const both = prev.focusedMs + cur.focusedMs;
  const prevMs = Math.min(both, Math.max(0, prev.focusedMs + (when - cur.startedAt)));
  const out = [...parts];
  out[i - 1] = { ...prev, endedAt: when, focusedMs: prevMs };
  out[i] = { ...cur, startedAt: when, focusedMs: both - prevMs };
  return out;
}
