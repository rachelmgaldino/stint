import { compactDuration } from "./analytics";
import { inputTime, timeRange, timeSpan } from "./dates";
import { capitalize, formatDate, language, t } from "./i18n";
import type { Category, SessionRecord } from "./store";

// A single day's sessions as a CSV to keep, or as a short text to paste
// somewhere, for tracking work hours.

/** "2026-10-19", from the day's local midnight. */
export function isoDay(day: number): string {
  const d = new Date(day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "6:40", for spreadsheet cells. */
export function hoursMinutes(ms: number): string {
  const m = Math.round(ms / 60_000);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

function totalsByCategory(sessions: SessionRecord[], categories: Category[]) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const rows = new Map<string, number>();
  for (const s of sessions) {
    if (s.kind !== "focus") continue;
    const name = s.categoryId === null ? t().report.noCategory : byId.get(s.categoryId)?.name ?? t().analytics.removedCategory;
    rows.set(name, (rows.get(name) ?? 0) + s.focusedMs);
  }
  return [...rows.entries()].sort((a, b) => b[1] - a[1]);
}

/**
 * The day as a CSV: one row per session and break in order, then the totals.
 * Portuguese uses semicolons and decimal commas, which is what Excel set to
 * Brazilian Portuguese expects.
 */
export function dayCsv(day: number, sessions: SessionRecord[], categories: Category[]): string {
  const text = t().report;
  const pt = language() === "pt-BR";
  const sep = pt ? ";" : ",";
  const cell = (v: string | number) => {
    const s = String(v);
    return s.includes(sep) || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const line = (cells: (string | number)[]) => cells.map(cell).join(sep);
  const hours = (ms: number) => {
    const h = (Math.round(ms / 60_000) / 60).toFixed(2);
    return pt ? h.replace(".", ",") : h;
  };
  const byId = new Map(categories.map((c) => [c.id, c]));
  const ordered = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
  const date = isoDay(day);

  const lines = [line(text.columns)];
  for (const s of ordered) {
    const c = s.categoryId !== null ? byId.get(s.categoryId) : undefined;
    const isBreak = s.kind === "break";
    lines.push(
      line([
        date,
        inputTime(s.startedAt),
        inputTime(s.endedAt),
        isBreak ? t().break : t().focus,
        isBreak ? "" : c?.name ?? "",
        isBreak ? "" : s.intention,
        hoursMinutes(s.focusedMs),
        hours(s.focusedMs),
        !isBreak && s.rating > 0 ? t().ratings[s.rating] : "",
        s.reflection,
      ]),
    );
  }

  const focus = ordered.filter((s) => s.kind === "focus").reduce((a, s) => a + s.focusedMs, 0);
  const breaks = ordered.filter((s) => s.kind === "break").reduce((a, s) => a + s.focusedMs, 0);
  lines.push("", line([text.totals, "", "", "", "", "", text.durationCol, text.hoursCol]));
  for (const [name, ms] of totalsByCategory(ordered, categories)) {
    lines.push(line([date, "", "", t().focus, name, "", hoursMinutes(ms), hours(ms)]));
  }
  lines.push(line([date, "", "", text.allFocus, "", "", hoursMinutes(focus), hours(focus)]));
  if (breaks > 0) lines.push(line([date, "", "", text.allBreaks, "", "", hoursMinutes(breaks), hours(breaks)]));
  // The byte order mark lets Excel read accents as UTF-8.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** The day as a few lines of plain text: totals, hours per category, then each session. */
export function daySummary(day: number, sessions: SessionRecord[], categories: Category[]): string {
  const text = t().report;
  const byId = new Map(categories.map((c) => [c.id, c]));
  const ordered = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
  const focus = ordered.filter((s) => s.kind === "focus");
  const focusMs = focus.reduce((a, s) => a + s.focusedMs, 0);
  const breakMs = ordered.filter((s) => s.kind === "break").reduce((a, s) => a + s.focusedMs, 0);
  const title = capitalize(formatDate(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" }));

  const out = [`Stint · ${title}`];
  if (ordered.length === 0) return [...out, t().analytics.noSessions].join("\n");
  out.push(text.focusedLine(compactDuration(focusMs), focus.length, compactDuration(breakMs)));
  out.push(timeRange(ordered[0].startedAt, ordered[ordered.length - 1].endedAt));
  const cats = totalsByCategory(ordered, categories);
  if (cats.length) {
    out.push("");
    for (const [name, ms] of cats) out.push(`${name}: ${compactDuration(ms)}`);
  }
  out.push("");
  for (const s of ordered) {
    const span = timeSpan(s.startedAt, s.endedAt);
    if (s.kind === "break") {
      out.push(`${span}  ${t().break} (${compactDuration(s.focusedMs)})`);
      continue;
    }
    const c = s.categoryId !== null ? byId.get(s.categoryId)?.name : undefined;
    const what = [c, s.intention.trim()].filter(Boolean).join(" · ") || t().focus;
    out.push(`${span}  ${what} (${compactDuration(s.focusedMs)})`);
  }
  return out.join("\n");
}
