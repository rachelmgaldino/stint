import type { Category, SessionRecord } from "../store";
import { formatDuration } from "../timer";

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const ratingLabel = ["", "Rough", "Okay", "Great"];

export function TodayView({ sessions, categories }: { sessions: SessionRecord[]; categories: Category[] }) {
  const focus = sessions.filter((s) => s.kind === "focus");
  const total = focus.reduce((a, s) => a + s.focusedMs, 0);
  const byId = new Map(categories.map((c) => [c.id, c]));

  return (
    <section className="today">
      <div className="stats">
        <div>
          <div className="stat">{formatDuration(total)}</div>
          <div className="muted">focused</div>
        </div>
        <div>
          <div className="stat">{focus.length}</div>
          <div className="muted">{focus.length === 1 ? "session" : "sessions"}</div>
        </div>
      </div>

      {sessions.length === 0 ? (
        <p className="empty">No sessions yet today. Start one from the Timer tab.</p>
      ) : (
        <ul className="log">
          {sessions.map((s) => {
            const c = s.categoryId !== null ? byId.get(s.categoryId) : undefined;
            return (
              <li key={s.id} className={s.kind === "break" ? "entry break" : "entry"}>
                <span className="dot" style={{ background: s.kind === "break" ? "var(--break)" : (c?.color ?? "var(--accent)") }} />
                <div className="entry-body">
                  <div className="entry-head">
                    <strong>{s.kind === "break" ? "Break" : s.intention || c?.name || "Focus session"}</strong>
                    <span className="muted">{formatDuration(s.focusedMs)}</span>
                  </div>
                  <div className="muted small">
                    {time(s.startedAt)} to {time(s.endedAt)}
                    {c && s.kind === "focus" && s.intention ? ` · ${c.name}` : ""}
                    {s.rating ? ` · ${ratingLabel[s.rating]}` : ""}
                  </div>
                  {s.reflection && <p className="reflection">{s.reflection}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
