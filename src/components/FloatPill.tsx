import { useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { Pip, type Mood } from "./Pip";
import { PinIcon } from "./floatIcons";
import type { FloatAnchor, FloatDrag } from "./FloatTimer";

// The ring in each place: its box, the circle's radius (to the middle of
// its 2.5px line) and Pip, which leaves 1px between itself and the line.
// In the resting pill the circle is 26.5 across and sits in the pill's
// rounded end; in the card it's 30 across, as wide as the buttons, and
// centred on the card's corner (6px in, 15 + 6 = 21, the corner's radius).
const RINGS = {
  rest: { box: 28, r: 12, pip: 19.5 },
  card: { box: 30, r: 13.75, pip: 23 },
};

type Props = {
  open: boolean;
  clock: string;
  /** How much of the ring and the bar is filled, 0 to 1. */
  done: number;
  over: boolean;
  /** The category's colour, when there is one. */
  color?: string;
  tag: string;
  mood: Mood;
  onTop: boolean;
  drag: FloatDrag;
  /** Which way the card opens: from the pill's centre, or from its edge on a docked side. */
  anchor: FloatAnchor;
  title: string;
  onPointerDown: (e: PointerEvent) => void;
  onDrop: () => void;
  onOpen: () => void;
  /** The same buttons as the bubble's shelf, from FloatTimer. */
  buttons: ReactNode;
  /** The resting pill's width whenever it changes, for float.rs's hover spot. */
  onRestWidth: (w: number) => void;
  /** How big the whole pill is drawn, 1 being normal (see SCALE). */
  scale: number;
  /** A new size from the handle under the card. */
  onScale: (scale: number) => void;
  /** The handle's tooltip and label. */
  resizeLabel: string;
};

/** The sizes the handle allows, in steps, and how far apart they are. */
export const SCALE = { min: 0.8, max: 1.5, step: 0.05 };
// From the pill's top to the handle's middle, at size 1: the card is 87 tall
// and the bar sits 6px under it, 4px tall. The 9px gap above the pill stays
// the same at every size, so only this part grows.
const HANDLE_BELOW = 95;

/** A size on one of the handle's steps, within its range. */
export function stepScale(s: number): number {
  const stepped = Math.round(s / SCALE.step) * SCALE.step;
  return Math.min(SCALE.max, Math.max(SCALE.min, Math.round(stepped * 100) / 100));
}

/**
 * The bar under the open card: pulled down it makes the whole pill bigger,
 * pulled up smaller, its own middle staying under the pointer; double-click
 * puts it back to normal. While the pill is held on the middle of the
 * screen it takes the category's colour, the snap's cue.
 */
function Handle({ scale, onScale, label, snapped, open, style }: { scale: number; onScale: (s: number) => void; label: string; snapped: boolean; open: boolean; style: CSSProperties }) {
  const held = useRef<{ y: number; scale: number } | null>(null);
  return (
    <button
      className={snapped ? "float-pill-handle snapped" : "float-pill-handle"}
      inert={!open}
      style={style}
      title={label}
      aria-label={label}
      onPointerDown={(e) => {
        if (e.button !== 0 || e.detail > 1) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        held.current = { y: e.screenY, scale };
      }}
      // The window itself grows while the bar is pulled, so the move is
      // measured on the screen, where the pointer really is.
      onPointerMove={(e) => {
        const h = held.current;
        if (h) onScale(stepScale(h.scale + (e.screenY - h.y) / HANDLE_BELOW));
      }}
      onPointerUp={() => (held.current = null)}
      onLostPointerCapture={() => (held.current = null)}
      onDoubleClick={() => onScale(1)}
      onKeyDown={(e) => {
        const by = e.key === "ArrowDown" ? SCALE.step : e.key === "ArrowUp" ? -SCALE.step : 0;
        if (!by) return;
        e.preventDefault();
        onScale(stepScale(scale + by));
      }}
    >
      <span className="float-pill-handle-bar" />
    </button>
  );
}

/** The small ring with the mascot inside, the pill's version of the bubble's ring. */
function Ring({ done, over, color, mood, at }: Pick<Props, "done" | "over" | "color" | "mood"> & { at: keyof typeof RINGS }) {
  const { box, r, pip } = RINGS[at];
  const c = box / 2;
  const ring = 2 * Math.PI * r;
  return (
    <span className="float-pill-face">
      <svg className="float-pill-ring" width={box} height={box} viewBox={`0 0 ${box} ${box}`} aria-hidden="true">
        <circle cx={c} cy={c} r={r} className="track" />
        <circle
          cx={c}
          cy={c}
          r={r}
          className={over ? "fill over" : "fill"}
          strokeDasharray={ring}
          strokeDashoffset={ring * (1 - done)}
          style={color && !over ? { stroke: color } : undefined}
        />
      </svg>
      <Pip size={pip} mood={mood} />
    </span>
  );
}

/**
 * The time with each digit in a cell as wide as a 0, so the pill keeps its
 * width as the seconds tick: some looks' fonts draw an 8 wider than a 7 even
 * with tabular figures asked for.
 */
function Clock({ text, over }: { text: string; over: boolean }) {
  return (
    <span className={over ? "float-clock over" : "float-clock"}>
      {[...text].map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} className="float-digit">
            {ch}
          </span>
        ) : (
          ch
        ),
      )}
    </span>
  );
}

/**
 * The floating timer as a pill at the top of the screen: the ring, the time
 * and the pin while resting, growing into a card with the category, a bar
 * and the buttons when the pointer is on it. FloatTimer keeps the timer's
 * state and hands it down; the window's size and the spot that opens it are
 * set in float.rs.
 */
export function FloatPill(p: Props) {
  // The resting pill hugs the ring, the time and the pin, so its width
  // follows them; rounded up to even so it stays centred on whole pixels.
  const inner = useRef<HTMLSpanElement>(null);
  const [restW, setRestW] = useState(132);
  // Off until the first measure has landed, so the pill doesn't animate from
  // the default width when it first shows.
  const [ready, setReady] = useState(false);
  const report = useRef(p.onRestWidth);
  report.current = p.onRestWidth;
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => {
      const w = Math.ceil(el.offsetWidth / 2) * 2;
      setRestW(w);
      report.current(w);
    };
    measure();
    const frame = requestAnimationFrame(() => setReady(true));
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      watch.disconnect();
    };
  }, []);
  const face = { done: p.done, over: p.over, color: p.color, mood: p.mood };
  const clock = <Clock text={p.clock} over={p.over} />;
  // A double click on a button is two clicks on it, not a request to open Stint.
  const dbl = (e: MouseEvent) => {
    if (!(e.target as Element).closest("button")) p.onOpen();
  };
  const handlers = {
    role: "timer",
    "aria-label": `${p.tag} ${p.clock}`,
    title: p.title,
    onPointerDown: p.onPointerDown,
    onPointerUp: p.onDrop,
    onLostPointerCapture: p.onDrop,
    onDoubleClick: dbl,
  };

  // While held and snapped to the middle of the screen or a side, an outline
  // around it and the handle under it, in the category's colour, say it has
  // landed there. A drag starts with the pointer on the pill, so the card is open.
  const snapped = p.drag.dragging && p.drag.snapped;
  const mark = {
    "--pill-mark": p.color ?? "var(--float-text)",
    "--rest-w": `${restW}px`,
  } as CSSProperties;
  const from = p.anchor === "center" ? "" : `from-${p.anchor}`;
  const shell = ["float-pill", from, ready ? "ready" : "", p.open ? "open" : "", snapped ? "snapped" : ""].join(" ");

  // One shell that grows from the pill into the card, with both rows inside
  // it: the one not showing fades out and is inert, so its buttons can't be
  // clicked or reached with Tab.
  return (
    <>
      <div className={shell} style={mark} {...handlers}>
        <div className="float-pill-rest" inert={p.open}>
          <span className={p.onTop ? "float-pill-rest-in pinned" : "float-pill-rest-in"} ref={inner}>
            <Ring {...face} at="rest" />
            {clock}
            {p.onTop && (
              <span className="float-pill-pin" aria-hidden="true">
                <PinIcon on />
              </span>
            )}
          </span>
        </div>
        <div className="float-card" inert={!p.open}>
          <div className="float-card-top">
            <Ring {...face} at="card" />
            {clock}
            {p.color && <span className="dot" style={{ background: p.color }} />}
            <span className="float-card-tag">{p.tag}</span>
          </div>
          <div className="float-card-bar">
            <span
              className={p.over ? "over" : undefined}
              style={{
                width: `${(p.over ? 1 : p.done) * 100}%`,
                ...(p.color && !p.over ? { background: p.color } : {}),
              }}
            />
          </div>
          <div className="float-card-shelf">{p.buttons}</div>
        </div>
      </div>
      <Handle scale={p.scale} onScale={p.onScale} label={p.resizeLabel} snapped={snapped} open={p.open} style={mark} />
    </>
  );
}
