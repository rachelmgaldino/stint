import type * as T from "./timer";
import type { DoneTask } from "./tasks";

// The running timer and what it's for, kept in localStorage so a restart of
// the app doesn't lose a session in progress.
// `long` marks a break that is a long one. `done` holds the tasks finished
// earlier in the running focus session with Next task; `intention` is the one now.
export type Live = { timer: T.Timer; intention: string; categoryId: number | null; long?: boolean; done?: DoneTask[] };

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;
const isNumber = (x: unknown) => typeof x === "number" && Number.isFinite(x);
const isCategoryId = (x: unknown) => x === null || isNumber(x);

function isTimer(t: unknown): t is T.Timer {
  if (!isObject(t)) return false;
  if (t.status === "idle") return true;
  const own = t.status === "running" ? [t.endsAt] : t.status === "paused" ? [t.remainingMs, t.pausedAt] : null;
  return (
    own !== null &&
    (t.kind === "focus" || t.kind === "break") &&
    [...own, t.startedAt, t.plannedMs, t.pausedMs].every(isNumber) &&
    (t.flow === undefined || typeof t.flow === "boolean")
  );
}

const isDoneTask = (d: unknown): d is DoneTask =>
  isObject(d) && typeof d.intention === "string" && isCategoryId(d.categoryId) && isNumber(d.endedAt) && isNumber(d.focusedMs);

/** True for a saved `Live` the app can run with, false for a damaged or hand-edited one. */
export function isLive(l: unknown): l is Live {
  return (
    isObject(l) &&
    isTimer(l.timer) &&
    typeof l.intention === "string" &&
    isCategoryId(l.categoryId) &&
    (l.long === undefined || typeof l.long === "boolean") &&
    (l.done === undefined || (Array.isArray(l.done) && l.done.every(isDoneTask)))
  );
}
