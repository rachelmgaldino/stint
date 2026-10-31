// Dev-only page that draws the floating timer in each state, for screenshots:
// /?float&look=lavender|mochi|notebook|riso&theme=light|dark&lang=en|pt-BR, add &desk=1
// (with &open=1&kind=break, and &edge=right|bottom|top for a bubble pushed
// against that screen edge, or &edge=stuck for where Windows used to stop it) for one bubble over a pretend desktop.
// The board shows the pill style below the bubbles.

import type { Language } from "../i18n";
import type { Look } from "../look";
import type { FloatStyle, Theme } from "../store";
import type { FloatState } from "../float";
import * as T from "../timer";
import type { FloatStep } from "./FloatNext";
import { FloatTimer, type FloatAnchor, type FloatDrag, type FloatEdges } from "./FloatTimer";
import "./FloatPreview.css";

const q = new URLSearchParams(location.search);
const NOW = 1_800_000_000_000;
const base = {
  category: { name: q.get("cat") ?? "Work", color: "#e8594f" },
  look: (q.get("look") ?? "lavender") as Look,
  theme: (q.get("theme") ?? "light") as Theme,
  language: (q.get("lang") ?? "en") as Language,
  long: false,
  style: "bubble" as FloatStyle,
  intention: "Ponto: comparar o Relatório Jornada",
  categoryId: 1,
  categories: [
    { id: 1, name: q.get("cat") ?? "Work", color: "#e8594f" },
    { id: 2, name: "Study", color: "#5b8def" },
    { id: 3, name: "Home", color: "#57b894" },
  ],
  done: [{ intention: "Call com o Daniel", categoryId: 1, endedAt: NOW - 6 * 60_000, focusedMs: 12 * 60_000 }],
  past: ["Design tela 2", "Daily organization", "Dentist forms", "Review pull request"].map((text, i) => ({
    text,
    categoryId: 1,
    uses: 4 - i,
    lastAt: NOW - i * 86_400_000,
  })),
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
const brkPaused: FloatState = { ...brk, timer: T.pause(brk.timer, NOW) };

// How far the window runs off the pretend screen in each spot (see .fpv-spot).
const EDGES: Record<string, FloatEdges> = {
  corner: { left: 0, right: 48, top: 0, bottom: 48 },
  right: { left: 0, right: 100, top: 0, bottom: 48 },
  bottom: { left: 0, right: 48, top: 0, bottom: 118 },
  top: { left: 0, right: 48, top: 124, bottom: 0 },
  // Where Windows used to stop a dragged bubble: the window's top at the
  // screen's top, the bubble below it.
  stuck: { left: 0, right: 48, top: 0, bottom: 0 },
};

// The same states drawn as the pill.
const pill = (s: FloatState): FloatState => ({ ...s, style: "pill" });
const flow: FloatState = {
  ...base,
  onTop: true,
  timer: { status: "running", kind: "focus", startedAt: NOW - 38 * 60_000, endsAt: NOW - 38 * 60_000, plannedMs: 0, pausedMs: 0, flow: true },
};

function Frame({
  state,
  open,
  label,
  edges,
  drag,
  anchor,
  card,
}: {
  state: FloatState;
  open: boolean;
  label?: string;
  edges?: FloatEdges;
  drag?: FloatDrag;
  anchor?: FloatAnchor;
  card?: FloatStep;
}) {
  return (
    <figure className="fpv-fig">
      <div className={state.style === "pill" ? "fpv-frame pill" : "fpv-frame"}>
        <FloatTimer preview={{ state, open, now: NOW, edges, drag, anchor, card }} />
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
        <div className={`fpv-spot ${q.get("edge") ?? "corner"}`}>
          <Frame state={q.get("kind") === "break" ? brk : focus(18)} open={open} edges={EDGES[q.get("edge") ?? "corner"]} />
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
      <div className="fpv-row">
        <Frame state={pill(focus(18))} open={false} label={pt ? "Pílula, foco" : "Pill, focus"} />
        <Frame state={pill(focus(18))} open label={pt ? "Com o ponteiro" : "Pointer on it"} />
        <Frame state={pill(brk)} open label={pt ? "Pausa" : "Break"} />
        <Frame state={pill(focus(-5))} open={false} label={pt ? "Passou do tempo" : "Over time"} />
        <Frame state={pill(paused)} open={false} label={pt ? "Pausada" : "Paused"} />
        <Frame state={pill(paused)} open label={pt ? "Pausada, com o ponteiro" : "Paused, pointer on it"} />
        <Frame state={pill(brkPaused)} open label={pt ? "Pausa pausada" : "Break paused"} />
        <Frame state={pill(flow)} open={false} label={pt ? "Fluxo" : "Flow"} />
        <Frame
          state={pill(focus(18))}
          open
          drag={{ dragging: true, snapped: true }}
          label={pt ? "Arrastando, no centro" : "Dragging, centred"}
        />
        <Frame state={pill(focus(18))} open anchor="left" label={pt ? "Na borda esquerda" : "Docked left"} />
        <Frame state={pill(focus(18))} open anchor="right" label={pt ? "Na borda direita" : "Docked right"} />
        <Frame state={pill(focus(18))} open card="current" label={pt ? "Tarefa atual" : "Current task"} />
        <Frame state={pill(focus(18))} open card="next" label={pt ? "Próxima tarefa" : "Next task"} />
        <Frame state={pill(focus(18))} open card="done" label={pt ? "Logo depois de trocar" : "Right after switching"} />
        <Frame state={pill(focus(18))} open card="current" anchor="left" label={pt ? "Tarefa atual, à esquerda" : "Current task, docked left"} />
        <Frame state={pill(focus(18))} open card="done" anchor="right" label={pt ? "Depois de trocar, à direita" : "After switching, docked right"} />
      </div>
    </div>
  );
}
