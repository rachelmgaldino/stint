import { compactDuration, type Stats } from "../analytics";
import { clockTime, startOfDay, weekDays } from "../dates";
import type { Category, SessionRecord } from "../store";
import { soft } from "../colors";
import { CoffeeIcon, PlusIcon } from "./icons";
import { GoalSprouts, Pip, RatingFace } from "./Pip";
import { capitalize, formatDate, t } from "../i18n";

type Props = {
  day: number;
  /** The day's sessions, focus and breaks. */
  sessions: SessionRecord[];
  /** Every session of the week the day is in. */
  week: SessionRecord[];
  stats: Stats;
  categories: Category[];
  now: number;
  dailyGoal: number;
  onDay(d: number): void;
  onOpen(s: SessionRecord): void;
  onAdd(): void;
};

const focusOf = (list: SessionRecord[]) => list.filter((s) => s.kind === "focus").reduce((a, s) => a + s.focusedMs, 0);

function weekTotals(day: number, week: SessionRecord[]) {
  const days = weekDays(day);
  const totals = days.map((d) => focusOf(week.filter((s) => startOfDay(s.startedAt) === d)));
  return { days, totals, max: Math.max(...totals, 3_600_000) };
}

/** On a phone, the week as seven small buttons, each with a bar for its focus time. */
function WeekStrip({ day, week, now, onDay }: { day: number; week: SessionRecord[]; now: number; onDay(d: number): void }) {
  const { days, totals, max } = weekTotals(day, week);
  const today = startOfDay(now);
  return (
    <nav className="week-strip" aria-label={t().analytics.kinds.week}>
      {days.map((d, i) => (
        <button
          key={d}
          className={d === day ? "strip-day selected" : d === today ? "strip-day today" : "strip-day"}
          aria-pressed={d === day}
          onClick={() => onDay(d)}
          disabled={d > today}
        >
          <span className="strip-name">
            {capitalize(formatDate(d, { weekday: "short" }))} {new Date(d).getDate()}
          </span>
          <span className="strip-bar" aria-hidden="true">
            <span style={{ height: `${(totals[i] / max) * 100}%` }} />
          </span>
          <span className="strip-total">{totals[i] ? compactDuration(totals[i]) : "–"}</span>
        </button>
      ))}
    </nav>
  );
}

/** On a desktop, the week as a list in the side column: a row per day with a sideways bar. */
function WeekList({ day, week, now, onDay }: { day: number; week: SessionRecord[]; now: number; onDay(d: number): void }) {
  const { days, totals, max } = weekTotals(day, week);
  const today = startOfDay(now);
  return (
    <section className="card week-list" aria-label={t().analytics.kinds.week}>
      <div className="card-head">
        <h2>{t().analytics.thisWeek}</h2>
      </div>
      {days.map((d, i) => (
        <button
          key={d}
          className={d === day ? "wl-day selected" : "wl-day"}
          aria-pressed={d === day}
          onClick={() => onDay(d)}
          disabled={d > today}
        >
          <span className="wl-name">
            {capitalize(formatDate(d, { weekday: "short" }))} {new Date(d).getDate()}
          </span>
          <span className="wl-bar" aria-hidden="true">
            <span style={{ width: `${(totals[i] / max) * 100}%` }} />
          </span>
          <span className="wl-total">{totals[i] ? compactDuration(totals[i]) : "–"}</span>
        </button>
      ))}
    </section>
  );
}

/** The day told in order: each session with its note, breaks between, and the free time in the gaps. */
function DayStory({ sessions, colorOf, byId, onOpen }: {
  sessions: SessionRecord[];
  colorOf(s: SessionRecord): string;
  byId: Map<number, Category>;
  onOpen(s: SessionRecord): void;
}) {
  const ordered = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
  const ratingName = t().ratings;
  return (
    <ol className="story">
      {ordered.map((s, i) => {
        const gap = i > 0 ? s.startedAt - ordered[i - 1].endedAt : 0;
        const c = s.categoryId !== null ? byId.get(s.categoryId) : undefined;
        const isBreak = s.kind === "break";
        return (
          <li key={s.id} className="story-item">
            {gap >= 30 * 60_000 && <div className="story-gap">{t().analytics.free(compactDuration(gap))}</div>}
            <div className={isBreak ? "story-row break" : "story-row"}>
              <span className="story-time">{clockTime(s.startedAt)}</span>
              <span className="story-dot" style={{ background: colorOf(s) }} aria-hidden="true" />
              {isBreak ? (
                <button className="story-break" onClick={() => onOpen(s)}>
                  <CoffeeIcon />
                  {t().break} · {compactDuration(s.focusedMs)}
                </button>
              ) : (
                <button className="story-card" onClick={() => onOpen(s)}>
                  <span className="story-top">
                    <span className="story-title">{s.intention || c?.name || t().focus}</span>
                    <span className="story-len">{compactDuration(s.focusedMs)}</span>
                  </span>
                  <span className="story-meta">
                    {c && (
                      <span className="story-tag" style={{ background: soft(c.color) }}>
                        {c.name}
                      </span>
                    )}
                    {t().timer.fromTo(clockTime(s.startedAt), clockTime(s.endedAt))}
                    {s.rating > 0 && (
                      <>
                        {" · "}
                        {ratingName[s.rating]}
                        <RatingFace value={s.rating} size={18} />
                      </>
                    )}
                  </span>
                  {s.reflection && <span className="story-note">{s.reflection}</span>}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function DayAnalytics({ day, sessions, week, stats, categories, now, dailyGoal, onDay, onOpen, onAdd }: Props) {
  const text = t().analytics;
  const byId = new Map(categories.map((c) => [c.id, c]));
  const colorOf = (s: SessionRecord) =>
    s.kind === "break" ? "var(--matcha)" : soft((s.categoryId !== null && byId.get(s.categoryId)?.color) || "#f4a988");
  const focus = sessions.filter((s) => s.kind === "focus");
  const rated = stats.ratings.focused + stats.ratings.neutral + stats.ratings.distracted;
  const pct = (n: number) => `${rated ? (n / rated) * 100 : 0}%`;

  // The week's average, over the days up to this one that had any focus.
  const weekDaysSoFar = weekDays(day).filter((d) => d <= Math.min(day, startOfDay(now)));
  const weekFocus = focusOf(week.filter((s) => startOfDay(s.startedAt) <= day));
  const weekAvg = weekFocus / Math.max(1, weekDaysSoFar.length);
  const ordered = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
  const longest = Math.max(0, ...focus.map((s) => s.focusedMs));
  const all = stats.totalFocus + stats.totalBreak;

  return (
    <>
      <div className="phone-only">
        <WeekStrip day={day} week={week} now={now} onDay={onDay} />
      </div>

      <div className="tiles">
        <div className="tile apricot">
          <div>
            <div className="eyebrow">{text.focused}</div>
            <div className="tile-value">{compactDuration(stats.totalFocus)}</div>
            <div className="tile-sub">{text.weekAverage(compactDuration(weekAvg))}</div>
          </div>
          <div className="tile-goal">
            <GoalSprouts done={focus.length} goal={dailyGoal} />
          </div>
        </div>
        <div className="tile">
          <div className="eyebrow muted">{text.howItFelt}</div>
          <div className="felt-faces" aria-label={text.feltCounts(stats.ratings.focused, stats.ratings.neutral, stats.ratings.distracted)}>
            {focus
              .filter((s) => s.rating > 0)
              .sort((a, b) => a.startedAt - b.startedAt)
              .map((s) => (
                <RatingFace key={s.id} value={s.rating} size={30} />
              ))}
          </div>
          <div className="felt-bar" aria-hidden="true">
            <span className="r3" style={{ width: pct(stats.ratings.focused) }} />
            <span className="r2" style={{ width: pct(stats.ratings.neutral) }} />
            <span className="r1" style={{ width: pct(stats.ratings.distracted) }} />
          </div>
          <div className="tile-sub">
            {text.feltCounts(stats.ratings.focused, stats.ratings.neutral, stats.ratings.distracted)}
          </div>
        </div>
        <div className="tile matcha">
          <div className="eyebrow">{text.rhythm}</div>
          <div className="tile-value">
            {ordered.length ? `${clockTime(ordered[0].startedAt)}–${clockTime(ordered[ordered.length - 1].endedAt)}` : "–"}
          </div>
          <div className="tile-sub">
            {text.longest(compactDuration(longest))} · {text.breaksTotal(compactDuration(stats.totalBreak))}
          </div>
        </div>
      </div>

      <div className="analytics-row top-row">
        <section className="card story-card-wrap" aria-label={text.yourDay}>
          <div className="card-head">
            <h2>{text.yourDay}</h2>
            <button className="add-button" aria-label={text.addSession} title={text.addSession} onClick={onAdd}>
              <PlusIcon />
            </button>
          </div>
          {sessions.length === 0 ? (
            <div className="entries-empty">
              <Pip mood="asleep" size={72} />
              <p>{text.noSessions}</p>
            </div>
          ) : (
            <DayStory sessions={sessions} colorOf={colorOf} byId={byId} onOpen={onOpen} />
          )}
        </section>

        <div className="day-side">
          <div className="desk-only">
            <WeekList day={day} week={week} now={now} onDay={onDay} />
          </div>
          <section className="card went-card" aria-label={text.whereTimeWent}>
            <div className="card-head">
              <h2>{text.whereTimeWent}</h2>
            </div>
            {stats.categories.length > 0 && (
              <div className="went-bar" aria-hidden="true">
                {stats.categories.map((c) => (
                  <span
                    key={c.key}
                    style={{ flex: c.ms / all, background: c.key === "break" ? "var(--matcha)" : soft(c.color) }}
                  />
                ))}
              </div>
            )}
            <ul className="went-list">
              {stats.categories.map((c) => (
                <li key={c.key}>
                  <span className="row-name">
                    {c.key === "break" ? <CoffeeIcon /> : <span className="dot" style={{ background: soft(c.color) }} />}
                    {c.name}
                  </span>
                  <span className="muted">{Math.round(c.ratio * 100)}%</span>
                  <strong>{compactDuration(c.ms)}</strong>
                </li>
              ))}
            </ul>
            {stats.intentions.length > 0 && (
              <>
                <h3 className="went-sub">{text.byIntention}</h3>
                <ul className="went-list">
                  {stats.intentions.map((i) => (
                    <li key={i.name}>
                      <span className="row-name">
                        <span className="dot" style={{ background: soft(i.color) }} />
                        {i.name}
                      </span>
                      <span className="muted">×{i.sessions}</span>
                      <strong>{compactDuration(i.ms)}</strong>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="went-pip">
              <Pip mood={stats.totalFocus > 0 ? "cheer" : "asleep"} size={64} />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
