import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { emitTo, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import * as T from "../timer";
import { soft } from "../colors";
import { lapAt } from "../dial";
import { setLanguage, t } from "../i18n";
import { setLook } from "../look";
import type { FloatAction, FloatState } from "../float";
import { dialClock, upClock } from "./TimerPane";
import { Pip } from "./Pip";
import { CheckIcon, CoffeeIcon, PlayIcon } from "./icons";
import { OpenIcon, PinIcon, StopIcon } from "./floatIcons";
import { FloatNext, type FloatStep } from "./FloatNext";
import { FloatPill } from "./FloatPill";
import "../float.css";

const R = 38;
const RING = 2 * Math.PI * R;

const send = (a: FloatAction) => void emitTo("main", "float-action", a).catch(() => {});

/** How much of the window runs off the screen on each side, from src-tauri/src/float.rs. */
export type FloatEdges = { left: number; right: number; top: number; bottom: number };
type Opened = FloatEdges & { open: boolean };
/** Sent by float_drag in float.rs while the pill is held, `snapped` once it sits on the middle of the screen or docked to a side. */
export type FloatDrag = { dragging: boolean; snapped: boolean };
/** Which way the pill's card opens, from float.rs: from its centre, or from its left or right edge when docked near that side. */
export type FloatAnchor = "center" | "left" | "right";

const NOT_DRAGGING: FloatDrag = { dragging: false, snapped: false };

const NO_EDGES: FloatEdges = { left: 0, right: 0, top: 0, bottom: 0 };
// The window and the bubble inside it, matching OPEN, SHIFT and BUBBLE in float.rs.
const WIN = { w: 300, h: 340 };
const BUB = { x: 104, y: 124, size: 92 };
const GAP = 8;
const PAD = 4;

/**
 * Where the category and the shelf of buttons go: centred on the bubble,
 * the category above and the buttons below, nudged sideways or moved to the
 * other side of the bubble when that part of the window is off the screen.
 * The bubble itself never moves.
 */
function layout(tag: DOMRect, shelf: DOMRect, e: FloatEdges, ring: number): { tag: CSSProperties; shelf: CSSProperties } {
  const cx = BUB.x + BUB.size / 2;
  const x = (w: number) => Math.max(e.left + PAD, Math.min(cx - w / 2, WIN.w - e.right - PAD - w));
  // The looks' outline ring is drawn outside each part, so the gaps grow by
  // it on both sides and stay as wide as in the plain look.
  const gap = GAP + 2 * ring;
  const near = 6 + 2 * ring;
  let shelfTop = BUB.y + BUB.size + gap;
  let tagTop = BUB.y - gap - tag.height;
  if (shelfTop + shelf.height + ring > WIN.h - e.bottom - PAD) {
    shelfTop = BUB.y - gap - shelf.height;
    tagTop = shelfTop - near - tag.height;
  } else if (tagTop - ring < e.top + PAD) {
    tagTop = shelfTop + shelf.height + near;
  }
  return {
    tag: { left: x(tag.width), top: tagTop },
    shelf: { left: x(shelf.width), top: shelfTop },
  };
}

/**
 * What the dev preview page (FloatPreview.tsx) hands in instead of the Rust
 * side and the main window, read again on every render.
 */
export type FloatPreviewProps = {
  state: FloatState;
  open: boolean;
  now: number;
  edges?: FloatEdges;
  drag?: FloatDrag;
  anchor?: FloatAnchor;
  /** Shows the Next task card at this step from the start. */
  card?: FloatStep;
};

/**
 * The floating timer's own window: a round bubble with the mascot, the time
 * and a ring that fills like the dial. With the pointer on it, the category
 * and a shelf of buttons show around it. The Rust side watches the pointer,
 * since the window lets clicks through to other apps while resting.
 */
export function FloatTimer({ preview }: { preview?: FloatPreviewProps }) {
  const [liveState, setState] = useState<FloatState | null>(null);
  const [liveNow, setNow] = useState(Date.now());
  const [liveOpened, setOpened] = useState<Opened>({ open: false, ...NO_EDGES });
  const [liveDrag, setDragging] = useState<FloatDrag>(NOT_DRAGGING);
  const [liveAnchor, setAnchor] = useState<FloatAnchor>("center");
  // The pill's size from the handle under its card, kept by float.rs.
  const [size, setSize] = useState(1);
  const [card, setCard] = useState(!!preview?.card);
  // In the preview these come from its props instead. The opened object is
  // kept while its values stay the same, since the bubble's layout effect
  // below runs again whenever it changes.
  const edges = preview?.edges;
  const previewOpened = useMemo<Opened | null>(
    () => (preview ? { open: preview.open, ...(edges ?? NO_EDGES) } : null),
    [!!preview, preview?.open, edges?.left, edges?.right, edges?.top, edges?.bottom],
  );
  const state = preview ? preview.state : liveState;
  const now = preview ? preview.now : liveNow;
  const opened = previewOpened ?? liveOpened;
  const dragging = preview ? (preview.drag ?? NOT_DRAGGING) : liveDrag;
  const anchor = preview ? (preview.anchor ?? "center") : liveAnchor;
  const [place, setPlace] = useState<{ tag: CSSProperties; shelf: CSSProperties } | null>(null);
  const tagRef = useRef<HTMLSpanElement>(null);
  const shelfRef = useRef<HTMLDivElement>(null);
  const open = opened.open;

  useEffect(() => {
    document.documentElement.classList.add("float-window");
    if (preview) return;
    const off = listen<FloatState>("float-state", (e) => setState(e.payload));
    const offOpen = listen<Opened>("float-open", (e) => setOpened(e.payload));
    const offDrag = listen<FloatDrag>("float-drag", (e) => setDragging(e.payload));
    const offAnchor = listen<FloatAnchor>("float-anchor", (e) => setAnchor(e.payload));
    invoke<number>("float_pill_size", { size: null })
      .then(setSize)
      .catch(() => {});
    void emitTo("main", "float-ready").catch(() => {});
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => {
      void off.then((f) => f());
      void offOpen.then((f) => f());
      void offDrag.then((f) => f());
      void offAnchor.then((f) => f());
      clearInterval(id);
    };
  }, []);

  // Measured before painting, so the parts appear straight in their place.
  // The pill lays itself out with CSS alone, so this is the bubble's only.
  useLayoutEffect(() => {
    if (state?.style === "pill" || !open || !tagRef.current || !shelfRef.current) return setPlace(null);
    const ring = parseFloat(getComputedStyle(tagRef.current).getPropertyValue("--float-ring")) || 0;
    setPlace(layout(tagRef.current.getBoundingClientRect(), shelfRef.current.getBoundingClientRect(), opened, ring));
  }, [opened, state]);

  useEffect(() => {
    if (!open) setCard(false);
  }, [open]);

  useEffect(() => {
    if (!state) return;
    const root = document.documentElement;
    root.dataset.look = state.look;
    if (state.theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", state.theme);
  }, [state]);

  if (!state || state.timer.status === "idle") return null;
  setLanguage(state.language);
  setLook(state.look);
  const text = t();
  const { timer } = state;
  const focus = timer.kind === "focus";
  const left = T.remaining(timer, now);
  const over = left < 0;
  const paused = timer.status === "paused";
  // Flow counts up, and its ring fills once an hour, like the dial's laps.
  const flow = T.isFlow(timer);
  const spent = T.elapsed(timer, now);
  const done = flow ? lapAt(spent / 60_000).fraction : over ? 1 : Math.min(1, Math.max(0, 1 - left / Math.max(1, timer.plannedMs)));
  const clock = flow ? upClock(spent) : dialClock(left);
  const color = focus && state.category ? soft(state.category.color) : undefined;
  const tag = focus ? (state.category?.name ?? text.focus) : state.long ? text.float.longBreak : text.float.shortBreak;
  const mood = paused ? "asleep" : focus ? "awake" : "break";

  // Stint moves the window itself while the bubble is held (see float_drag
  // in float.rs), so the bubble can reach the very top of the screen. The
  // pill's buttons and field sit inside the part that drags, so a press on them is left alone.
  const drag = (e: PointerEvent) => {
    if (e.button !== 0 || e.detail > 1 || (e.target as Element).closest("button, input")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    void invoke("float_drag", { start: true }).catch(() => {});
  };
  const drop = () => void invoke("float_drag", { start: false }).catch(() => {});
  // A new size from the handle: drawn here at once, and float.rs resizes the
  // window around the pill and keeps the size for next time.
  const resize = (next: number) => {
    if (next === size) return;
    setSize(next);
    if (!preview) void invoke("float_pill_size", { size: next }).catch(() => {});
  };

  const pill = state.style === "pill";
  // The same four buttons on the bubble's shelf and in the pill's card, where Next task comes first.
  const buttons = (
    <>
      {focus && pill && (
        <button className="float-btn" title={text.timer.nextTask} aria-label={text.timer.nextTask} onClick={() => setCard(true)}>
          <CheckIcon />
        </button>
      )}
      {focus ? (
        <button className="float-btn" title={text.timer.takeBreak} aria-label={text.timer.takeBreak} onClick={() => send("break")}>
          <CoffeeIcon />
        </button>
      ) : (
        <button className="float-btn main" title={text.timer.backToFocus} aria-label={text.timer.backToFocus} onClick={() => send("focus")}>
          <PlayIcon />
        </button>
      )}
      <button
        className={focus ? "float-btn main" : "float-btn"}
        title={focus ? text.timer.endSession : text.timer.endBreak}
        aria-label={focus ? text.timer.endSession : text.timer.endBreak}
        onClick={() => send("end")}
      >
        <StopIcon />
      </button>
      <button
        className={state.onTop ? "float-btn pin on" : "float-btn pin"}
        title={state.onTop ? text.float.pinOn : text.float.pinOff}
        aria-label={state.onTop ? text.float.pinOn : text.float.pinOff}
        aria-pressed={state.onTop}
        onClick={() => send("pin")}
      >
        <PinIcon on={state.onTop} />
      </button>
      <button className="float-btn" title={text.float.open} aria-label={text.float.open} onClick={() => send("open")}>
        <OpenIcon />
      </button>
    </>
  );
  const form = card && focus && pill ? <FloatNext state={state} now={now} preview={preview?.card} onAction={send} onClose={() => setCard(false)} /> : null;
  const className = ["float", focus ? "" : "break", open ? "open" : "", paused ? "paused" : ""].join(" ");

  if (pill)
    return (
      // The whole pill is drawn at its size at once, so every gap and curve
      // keeps its ratio.
      <div className={`${className} pill`} style={{ zoom: size, "--pill-top": `${9 / size}px` } as CSSProperties}>
        <FloatPill
          open={open}
          clock={clock}
          done={done}
          over={over}
          color={color}
          tag={tag}
          mood={mood}
          onTop={state.onTop}
          drag={dragging}
          anchor={anchor}
          title={text.float.open}
          onPointerDown={drag}
          onDrop={drop}
          onOpen={() => send("open")}
          buttons={buttons}
          form={form}
          paused={paused}
          onTogglePause={() => send(paused ? "resume" : "pause")}
          pauseLabel={paused ? (focus ? text.timer.resume : text.timer.resumeBreak) : focus ? text.timer.pauseSession : text.timer.pauseBreak}
          onRestWidth={(width) => void invoke("float_pill_width", { width }).catch(() => {})}
          scale={size}
          onScale={resize}
          resizeLabel={text.float.resize}
        />
      </div>
    );

  return (
    <div className={className}>
      {open && (
        <span className="float-tag" ref={tagRef} style={place?.tag ?? { visibility: "hidden" }}>
          {color && <span className="dot" style={{ background: color }} />}
          <span className="float-tag-name">{tag}</span>
        </span>
      )}
      <div
        className="float-bubble"
        role="timer"
        aria-label={`${tag} ${clock}`}
        title={text.float.open}
        onPointerDown={drag}
        onPointerUp={drop}
        onLostPointerCapture={drop}
        onDoubleClick={() => send("open")}
      >
        <svg className="float-ring" width="92" height="92" viewBox="0 0 92 92" aria-hidden="true">
          <circle cx="46" cy="46" r={R} className="track" />
          <circle
            cx="46"
            cy="46"
            r={R}
            className={over ? "fill over" : "fill"}
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - done)}
            style={color && !over ? { stroke: color } : undefined}
          />
        </svg>
        <span className="float-face">
          <Pip size={30} mood={mood} />
        </span>
        <span className={over ? "float-clock over" : "float-clock"}>{clock}</span>
        {state.onTop && !open && (
          <span className="float-pinned" aria-hidden="true">
            <PinIcon on />
          </span>
        )}
      </div>
      {open && (
        <div className="float-shelf" ref={shelfRef} style={place?.shelf ?? { visibility: "hidden" }}>
          {buttons}
        </div>
      )}
    </div>
  );
}
