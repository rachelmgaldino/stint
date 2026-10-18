import type { SessionRecord } from "../store";
import { startOfDay, weekDays } from "../dates";

/** "3:18" for 3 h 18 min. */
function hoursMinutes(ms: number): string {
  const m = Math.round(ms / 60_000);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

type Props = {
  day: number;
  now: number;
  week: SessionRecord[];
  /** Highlight every day of the week instead of just the selected one. */
  wholeWeek?: boolean;
  onDay(day: number): void;
};

export function WeekStrip({ day, now, week, wholeWeek, onDay }: Props) {
  const today = startOfDay(now);
  return (
    <div className="week-strip" role="tablist" aria-label="Week">
      {weekDays(day).map((d) => {
        const total = week
          .filter((s) => s.kind === "focus" && startOfDay(s.startedAt) === d)
          .reduce((a, s) => a + s.focusedMs, 0);
        const date = new Date(d);
        const selected = wholeWeek || d === day;
        return (
          <button
            key={d}
            role="tab"
            aria-selected={selected}
            className={selected ? "week-day selected" : "week-day"}
            onClick={() => onDay(d)}
          >
            <span className="wd">{date.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase()}</span>
            <span className="dn">{date.getDate()}</span>
            {d === today && <span className="today-dot" />}
            <span className="wt">{hoursMinutes(total)}</span>
          </button>
        );
      })}
    </div>
  );
}
