// Which alarms a timer needs right now: the end of a session or break, a
// heads-up shortly before it, a nudge once it runs too long (or stays paused
// too long), and the presence sound during focus. Pure, so it can be tested;
// App hands the result to the platform to schedule.

import type { PlannedAlarm } from "./platform";
import type { Settings } from "./store";
import type { Timer } from "./timer";
import { t } from "./i18n";

const MIN = 60_000;

export function plannedAlarms(timer: Timer, s: Settings, intention: string, now: number): PlannedAlarm[] {
  if (timer.status === "idle") return [];
  const text = t().notice;
  const focus = timer.kind === "focus";
  const alarms: PlannedAlarm[] = [];
  const add = (a: PlannedAlarm) => {
    if (a.at > now && (a.notice || a.sound)) alarms.push(a);
  };

  if (timer.status === "paused") {
    if (s.overflowPause) {
      const n = s.overflowPauseMinutes;
      add({
        key: "pause",
        at: timer.pausedAt + n * MIN,
        notice: { title: text.pauseTitle, body: text.pauseBody(focus, intention, n) },
      });
    }
    return alarms;
  }

  // Flow has no end, so only the presence sound applies.
  const flow = !!timer.flow;
  const end = flow ? Infinity : timer.endsAt;
  const wantsEnd = focus ? s.notifyFocusEnd : s.notifyBreakEnd;
  if (!flow) add({
    key: "end",
    at: end,
    notice: wantsEnd
      ? {
          title: focus ? text.focusTitle : text.breakTitle,
          body: focus ? `${intention ? `${intention}. ` : ""}${text.focusBody}` : text.breakBody,
        }
      : undefined,
    sound: s.sound ? "chime" : undefined,
  });

  // A heads-up only makes sense if the session is longer than the warning.
  if (!flow && s.notifySoon && s.soonMinutes * MIN < timer.plannedMs) {
    add({
      key: "soon",
      at: end - s.soonMinutes * MIN,
      notice: { title: text.soonTitle, body: text.soonBody(focus, intention, s.soonMinutes) },
      sound: s.soonSound ? "soon" : undefined,
    });
  }

  const over = focus ? s.overflowFocus : s.overflowBreak;
  if (over && !flow) {
    const n = focus ? s.overflowFocusMinutes : s.overflowBreakMinutes;
    add({
      key: "overflow",
      at: end + n * MIN,
      notice: focus
        ? { title: text.overflowFocusTitle, body: text.overflowFocusBody(intention, n) }
        : { title: text.overflowBreakTitle, body: text.overflowBreakBody(n) },
    });
  }

  // Every N minutes of focus (pauses don't count), up to the end, where the
  // end chime takes over. In flow it keeps going.
  if (focus && s.presence) {
    const every = s.presenceMinutes * MIN;
    const focusStart = timer.startedAt + timer.pausedMs;
    const next = focusStart + (Math.floor((now - focusStart) / every) + 1) * every;
    if (next < end - 30_000) add({ key: "presence", at: next, sound: "presence" });
  }

  return alarms;
}
