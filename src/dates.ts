import { capitalize, formatDate, language, t } from "./i18n";

// Local-time calendar helpers. Days are identified by the timestamp of their
// local midnight; adding days goes through Date so DST changes are handled.

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(dayMs: number, n: number): number {
  const d = new Date(dayMs);
  d.setDate(d.getDate() + n);
  return startOfDay(d.getTime());
}

/** Monday of the week containing `ms`. */
export function startOfWeek(ms: number): number {
  const d = new Date(startOfDay(ms));
  const sinceMonday = (d.getDay() + 6) % 7;
  return addDays(d.getTime(), -sinceMonday);
}

export function weekDays(ms: number): number[] {
  const first = startOfWeek(ms);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

/** "21:14", the form time fields and the CSV export use whatever the language. */
export function inputTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** A time to show: "9:14 PM" in English, "21:14" in Portuguese. */
export function clockTime(ms: number): string {
  if (language() !== "en") return inputTime(ms);
  const d = new Date(ms);
  const h = d.getHours();
  // A no-break space keeps "PM" on the same line as the time.
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}\u00a0${h < 12 ? "AM" : "PM"}`;
}

/** "9:14 to 9:39 PM" (AM/PM said once when both share it), "21:14 às 21:39". */
export function timeRange(from: number, to: number): string {
  return t().timer.fromTo(...shortPair(from, to));
}

/** "9:00–10:30 AM", "09:00–10:30". */
export function timeSpan(from: number, to: number): string {
  return shortPair(from, to).join("–");
}

function shortPair(from: number, to: number): [string, string] {
  const a = clockTime(from);
  const b = clockTime(to);
  const sameHalf = language() === "en" && a.slice(-2) === b.slice(-2);
  return [sameHalf ? a.slice(0, -3) : a, b];
}

/** "Sat 17 Oct", or "Sáb 17 out" in Portuguese. */
export function dayLabel(ms: number): string {
  const wd = capitalize(formatDate(ms, { weekday: "short" }));
  const mon = formatDate(ms, { month: "short" });
  return `${wd} ${new Date(ms).getDate()} ${mon}`;
}

/** Milliseconds since that day's local midnight. */
export function msIntoDay(ms: number): number {
  return ms - startOfDay(ms);
}

/** The next :00 or :30 after `now`, never `now` itself. Past 23:30 that is the next day. */
export function nextHalfHour(now: number): number {
  const d = new Date(now);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return d.getTime();
}

/** Parse "HH:MM" on a given day. Returns null for anything malformed. */
export function atTime(dayMs: number, hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const d = new Date(dayMs);
  d.setHours(h, min, 0, 0);
  return d.getTime();
}

/** "2026-10-18", the value of a date input. */
export function isoDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local midnight of a "YYYY-MM-DD" date. Returns null for anything malformed. */
export function fromIsoDate(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getMonth() !== Number(m[2]) - 1) return null;
  return d.getTime();
}
