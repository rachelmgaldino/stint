// Dev-only page that draws the floating timer in each state, for screenshots:
// /?float&look=lavender|mochi&theme=light|dark&lang=en|pt-BR, add &desk=1
// (with &open=1&kind=break) for one bubble over a pretend desktop.

import type { Language } from "../i18n";
import type { Look } from "../look";
import type { Theme } from "../store";
import type { FloatState } from "../float";
import * as T from "../timer";
import { FloatTimer } from "./FloatTimer";
import "./FloatPreview.css";

const q = new URLSearchParams(location.search);
const NOW = 1_800_000_000_000;
const base = {
  category: { name: q.get("cat") ?? "Work", color: "#e8594f" },
  look: (q.get("look") ?? "lavender") as Look,
  theme: (q.get("theme") ?? "light") as Theme,
  language: (q.get("lang") ?? "en") as Language,
  long: false,
};

const focus = (leftMin: number, onTop = true): FloatState => ({
  ...base,
  onTop,
  timer: { status: "running", kind: "focus", startedAt: NOW - (25 - leftMin) * 60_000, endsAt: NOW + leftMin * 60_000 + 18_000, plannedMs: 25 * 60_000, pausedMs: 0 },
});
const brk: FloatState = {
  ...base,
  onTop: true,
  timer: { status: "running", kind: "break", startedAt: NOW - 2 * 60_000, endsAt: NOW + 3 * 60_000 + 15_000, plannedMs: 5 * 60_000, pausedMs: 0 },
};
const paused: FloatState = { ...focus(12), timer: T.pause(focus(12).timer, NOW) };

function Frame({ state, open, label }: { state: FloatState; open: boolean; label?: string }) {
  return (
    <figure className="fpv-fig">
      <div className={open ? "fpv-frame open" : "fpv-frame"}>
        <FloatTimer preview={{ state, open, now: NOW }} />
      </div>
      {label && <figcaption>{label}</figcaption>}
    </figure>
  );
}

export function FloatPreview() {
  const root = document.documentElement;
  root.dataset.look = base.look;
  root.setAttribute("data-theme", base.theme);
  const pt = base.language === "pt-BR";
  if (q.get("desk") === "1") {
    const open = q.get("open") === "1";
    return (
      <div className="fpv-desk">
        <div className="fpv-app">
          <div className="fpv-bar">
            <b>Chapter 3 draft.docx</b>
          </div>
          <div className="fpv-body">
            <h2>Chapter 3</h2>
            {Array.from({ length: 9 }, (_, i) => (
              <p key={i} style={{ width: `${70 + ((i * 37) % 28)}%` }} />
            ))}
          </div>
        </div>
        <div className={open ? "fpv-spot open" : "fpv-spot"}>
          <Frame state={q.get("kind") === "break" ? brk : focus(18)} open={open} />
        </div>
        <div className="fpv-taskbar">
          <span />
          <span />
          <span className="stint" />
          <span />
          <i>14:32</i>
        </div>
      </div>
    );
  }
  return (
    <div className="fpv-board">
      <Frame state={focus(18, false)} open={false} label={pt ? "Foco" : "Focus"} />
      <Frame state={focus(18)} open label={pt ? "Com o ponteiro, fixado" : "Pointer on it, pinned"} />
      <Frame state={focus(-5)} open={false} label={pt ? "Passou do tempo" : "Over time"} />
      <Frame state={paused} open={false} label={pt ? "Pausada" : "Paused"} />
      <Frame state={brk} open label={pt ? "Pausa" : "Break"} />
    </div>
  );
}
