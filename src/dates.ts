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

/** "21:14" */
export function clockTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "Sat 17 Oct" */
export function dayLabel(ms: number): string {
  const d = new Date(ms);
  const wd = d.toLocaleDateString("en-GB", { weekday: "short" });
  const mon = d.toLocaleDateString("en-GB", { month: "short" });
  return `${wd} ${d.getDate()} ${mon}`;
}

/** Milliseconds since that day's local midnight. */
export function msIntoDay(ms: number): number {
  return ms - startOfDay(ms);
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
