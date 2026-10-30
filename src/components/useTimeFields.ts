import { useState, type KeyboardEvent } from "react";
import { addDays, atTime, clockTime, inputTime } from "../dates";
import { t } from "../i18n";
import { formatDuration, parseDuration } from "../timer";

/** The end that keeps a length from a start, as HH:MM. */
export function endFor(from: number, min: number): string {
  return inputTime(from + min * 60_000);
}

/** The length from a start to an end, rolling past midnight. Null for a malformed end. */
export function lengthOf(day: number, from: number, to: string): number | null {
  let toMs = atTime(day, to);
  if (toMs === null) return null;
  if (toMs <= from) toMs = atTime(addDays(day, 1), to) ?? toMs;
  return toMs - from;
}

/** The next multiple of 5 minutes up or down from a length, even when it sits between two. */
export function stepMinutes(now: number, up: boolean): number {
  return up ? Math.floor(now / 5) * 5 + 5 : Math.ceil(now / 5) * 5 - 5;
}

type Options = {
  /** The day the fields apply to, as of this render: it can change while they're open. */
  day: number;
  /** First values, in ms. Later renders ignore these, like any useState default. */
  start: number;
  end: number;
  /** Which of Duration and End to keep at first when Start changes. */
  held: "duration" | "end";
  /** A time field was changed by hand, even if nothing else moved with it. */
  onTouched?(): void;
  /** Another field moved on its own. The note says why; it's empty when that's obvious. */
  onMoved?(field: "end" | "duration", note: string): void;
};

/** The linked Start, Duration and End fields: changing one moves the others to match. */
export function useTimeFields({ day, start: firstStart, end: firstEnd, held: firstHeld, onTouched, onMoved }: Options) {
  const [start, setStart] = useState(inputTime(firstStart));
  const [end, setEnd] = useState(inputTime(firstEnd));
  const [duration, setDuration] = useState(formatDuration(firstEnd - firstStart));
  // Which of Duration and End stays put when Start changes: the one typed last.
  const [held, setHeld] = useState(firstHeld);
  const text = t().dialog;

  const startMs = atTime(day, start);
  const sameDayEnd = atTime(day, end);
  // An end before the start is on the next day: 23:30 to 00:30 is an hour.
  const nextDay = startMs !== null && sameDayEnd !== null && sameDayEnd <= startMs;
  const endMs = sameDayEnd !== null && nextDay ? atTime(addDays(day, 1), end) : sameDayEnd;
  const minutes = parseDuration(duration);

  const changeStart = (v: string) => {
    setStart(v);
    onTouched?.();
    const from = atTime(day, v);
    if (from === null) return;
    if (held === "duration" && minutes !== null && minutes > 0) {
      setEnd(endFor(from, minutes));
      onMoved?.("end", text.keptLength(formatDuration(minutes * 60_000)));
    } else {
      const ms = lengthOf(day, from, end);
      if (ms === null) return;
      setDuration(formatDuration(ms));
      onMoved?.("duration", text.keptEnd(clockTime(from + ms)));
    }
  };
  const changeDuration = (v: string) => {
    setDuration(v);
    setHeld("duration");
    onTouched?.();
    const min = parseDuration(v);
    if (startMs === null || min === null || min < 1 || min >= 24 * 60) return;
    setEnd(endFor(startMs, min));
    onMoved?.("end", "");
  };
  const changeEnd = (v: string) => {
    setEnd(v);
    setHeld("end");
    onTouched?.();
    if (startMs === null) return;
    const ms = lengthOf(day, startMs, v);
    if (ms === null) return;
    setDuration(formatDuration(ms));
    onMoved?.("duration", "");
  };
  // Tidy what was typed ("90" becomes "1h 30m") once the field is left.
  const tidyDuration = () => {
    if (minutes !== null && minutes > 0) setDuration(formatDuration(minutes * 60_000));
  };
  // Arrow keys step by 5 minutes.
  const stepDuration = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const next = stepMinutes(minutes ?? 0, e.key === "ArrowUp");
    if (next >= 5) changeDuration(formatDuration(next * 60_000));
  };
  /** Resizes from a start without counting as a change by hand. */
  const setLength = (from: number, min: number) => {
    setEnd(endFor(from, min));
    setDuration(formatDuration(min * 60_000));
  };

  return {
    start,
    end,
    duration,
    held,
    startMs,
    sameDayEnd,
    nextDay,
    endMs,
    minutes,
    changeStart,
    changeDuration,
    changeEnd,
    tidyDuration,
    stepDuration,
    setLength,
  };
}
