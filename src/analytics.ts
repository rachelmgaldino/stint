import { addDays, startOfDay, startOfWeek } from "./dates";
import type { Category, SessionRecord } from "./store";
import { t } from "./i18n";

export type RangeKind = "day" | "week" | "month";
export type Range = { kind: RangeKind; from: number; to: number };

export function rangeFor(kind: RangeKind, ms: number): Range {
  if (kind === "day") {
    const from = startOfDay(ms);
    return { kind, from, to: addDays(from, 1) };
  }
  if (kind === "week") {
    const from = startOfWeek(ms);
    return { kind, from, to: addDays(from, 7) };
  }
  const d = new Date(ms);
  const from = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  return { kind, from, to };
}

/** The range of the same kind just before this one. */
export function previousRange(r: Range): Range {
  return rangeFor(r.kind, r.from - 1);
}

/** The range of the same kind just after this one. */
export function nextRange(r: Range): Range {
  return rangeFor(r.kind, r.to);
}

export type CategoryRow = {
  /** Category id, or "break" for the break row. */
  key: number | "break";
  name: string;
  color: string;
  ms: number;
  /** Share of all tracked time, focus and breaks together. */
  ratio: number;
  change: number | null;
};

export type IntentionRow = { name: string; color: string; ms: number; ratio: number; sessions: number };

export type Stats = {
  totalFocus: number;
  totalBreak: number;
  avgFocusPerDay: number;
  focusChange: number | null;
  breakChange: number | null;
  avgChange: number | null;
  /** Focus time per break time, or null with no breaks. */
  focusPerBreak: number | null;
  ratings: { focused: number; neutral: number; distracted: number };
  mostFocused: string | null;
  mostDistracted: string | null;
  categories: CategoryRow[];
  intentions: IntentionRow[];
  /** Focus time per day of the range. */
  perDay: { day: number; ms: number }[];
};

const sum = (list: SessionRecord[]) => list.reduce((a, s) => a + s.focusedMs, 0);

export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Days that count towards the daily average: the whole range for a past
 * period, or the days up to and including today for the current one.
 */
export function daysCounted(r: Range, now: number): number {
  const end = Math.min(r.to, addDays(startOfDay(now), 1));
  if (end <= r.from) return 1;
  return Math.max(1, Math.round((end - r.from) / 86_400_000));
}

function categoryWithMost(focus: SessionRecord[], rating: number, names: Map<number, Category>): string | null {
  const tally = new Map<number, { n: number; ms: number }>();
  for (const s of focus) {
    if (s.rating !== rating || s.categoryId === null) continue;
    const t = tally.get(s.categoryId) ?? { n: 0, ms: 0 };
    tally.set(s.categoryId, { n: t.n + 1, ms: t.ms + s.focusedMs });
  }
  let best: [number, { n: number; ms: number }] | null = null;
  for (const entry of tally) {
    if (!best || entry[1].n > best[1].n || (entry[1].n === best[1].n && entry[1].ms > best[1].ms)) best = entry;
  }
  return best ? (names.get(best[0])?.name ?? null) : null;
}

export function computeStats(
  range: Range,
  sessions: SessionRecord[],
  previous: SessionRecord[],
  categories: Category[],
  now: number,
): Stats {
  const names = new Map(categories.map((c) => [c.id, c]));
  const focus = sessions.filter((s) => s.kind === "focus");
  const breaks = sessions.filter((s) => s.kind === "break");
  const prevFocus = previous.filter((s) => s.kind === "focus");
  const prevBreaks = previous.filter((s) => s.kind === "break");
  const totalFocus = sum(focus);
  const totalBreak = sum(breaks);
  const all = totalFocus + totalBreak;
  const days = daysCounted(range, now);
  const prevAvg = sum(prevFocus) / daysCounted(previousRange(range), now);

  const byCategory = new Map<number, SessionRecord[]>();
  for (const s of focus) {
    if (s.categoryId === null) continue;
    byCategory.set(s.categoryId, [...(byCategory.get(s.categoryId) ?? []), s]);
  }
  const categoryRows: CategoryRow[] = [...byCategory.entries()]
    .map(([id, list]) => {
      const ms = sum(list);
      const c = names.get(id);
      return {
        key: id,
        name: c?.name ?? t().analytics.removedCategory,
        color: c?.color ?? "var(--muted)",
        ms,
        ratio: all ? ms / all : 0,
        change: percentChange(ms, sum(prevFocus.filter((s) => s.categoryId === id))),
      };
    })
    .sort((a, b) => b.ms - a.ms);
  if (totalBreak > 0) {
    categoryRows.push({
      key: "break",
      name: t().break,
      color: "var(--break)",
      ms: totalBreak,
      ratio: totalBreak / all,
      change: percentChange(totalBreak, sum(prevBreaks)),
    });
  }

  // Sessions without an intention are grouped under their category's name.
  const byIntention = new Map<string, { color: string; ms: number; sessions: number }>();
  for (const s of focus) {
    const c = s.categoryId !== null ? names.get(s.categoryId) : undefined;
    const name = s.intention.trim() || c?.name || t().analytics.noIntention;
    const row = byIntention.get(name) ?? { color: c?.color ?? "var(--accent)", ms: 0, sessions: 0 };
    byIntention.set(name, { ...row, ms: row.ms + s.focusedMs, sessions: row.sessions + 1 });
  }
  const intentions = [...byIntention.entries()]
    .map(([name, r]) => ({ name, ...r, ratio: totalFocus ? r.ms / totalFocus : 0 }))
    .sort((a, b) => b.ms - a.ms);

  const perDay: Stats["perDay"] = [];
  for (let d = range.from; d < range.to; d = addDays(d, 1)) {
    perDay.push({ day: d, ms: sum(focus.filter((s) => startOfDay(s.startedAt) === d)) });
  }

  return {
    totalFocus,
    totalBreak,
    avgFocusPerDay: totalFocus / days,
    focusChange: percentChange(totalFocus, sum(prevFocus)),
    breakChange: percentChange(totalBreak, sum(prevBreaks)),
    avgChange: percentChange(totalFocus / days, prevAvg),
    focusPerBreak: totalBreak > 0 ? totalFocus / totalBreak : null,
    ratings: {
      focused: focus.filter((s) => s.rating === 3).length,
      neutral: focus.filter((s) => s.rating === 2).length,
      distracted: focus.filter((s) => s.rating === 1).length,
    },
    mostFocused: categoryWithMost(focus, 3, names),
    mostDistracted: categoryWithMost(focus, 1, names),
    categories: categoryRows,
    intentions,
    perDay,
  };
}

/** "3h18min", "43min", "0min" as in Session's stats. */
export function compactDuration(ms: number): string {
  const m = Math.round(ms / 60_000);
  const h = Math.floor(m / 60);
  if (h === 0) return `${m}min`;
  return m % 60 === 0 ? `${h}h` : `${h}h${m % 60}min`;
}

/** "2h33", "24m", "3h" for tight spots like the phone's week chart. */
export function shortDuration(ms: number): string {
  const m = Math.round(ms / 60_000);
  const h = Math.floor(m / 60);
  if (h === 0) return `${m}m`;
  return m % 60 === 0 ? `${h}h` : `${h}h${String(m % 60).padStart(2, "0")}`;
}
