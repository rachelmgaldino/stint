import { useRef } from "react";
import { clampMinutes, minuteAt, nextHourOffset, slicePath } from "../dial";

type Props = {
  /** Minutes shown by the slice. Over 60 fills the whole face. */
  minutes: number;
  color: string;
  maxMinutes: number;
  /** Called with whole minutes while the user drags. Omit to make the dial read-only. */
  onChange?(minutes: number): void;
  label: string;
};

const SIZE = 320;
const C = SIZE / 2;
const FACE = 100;

const ticks = Array.from({ length: 60 }, (_, i) => {
  const a = (i / 60) * 2 * Math.PI;
  const major = i % 15 === 0;
  const mid = i % 5 === 0;
  const outer = 150;
  const inner = major ? 132 : mid ? 136 : 142;
  return {
    x1: C + outer * Math.sin(a),
    y1: C - outer * Math.cos(a),
    x2: C + inner * Math.sin(a),
    y2: C - inner * Math.cos(a),
    cls: major ? "tick major" : mid ? "tick mid" : "tick",
  };
});

export function Dial({ minutes, color, maxMinutes, onChange, label }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ hourOffset: number; prev: number } | null>(null);
  const fraction = Math.min(1, Math.max(0, minutes / 60));

  const pointMinute = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const scale = SIZE / r.width;
    return minuteAt((e.clientX - r.left) * scale - C, (e.clientY - r.top) * scale - C);
  };

  const onDown = (e: React.PointerEvent) => {
    if (!onChange) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const m = pointMinute(e);
    // Keep the current hours so grabbing a 90 minute timer doesn't reset it to 30.
    const hourOffset = Math.floor(Math.max(0, minutes - 0.5) / 60) * 60;
    drag.current = { hourOffset, prev: m };
    onChange(clampMinutes(hourOffset + m, maxMinutes));
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !onChange) return;
    const m = pointMinute(e);
    const hourOffset = Math.max(0, nextHourOffset(drag.current.hourOffset, drag.current.prev, m));
    drag.current = { hourOffset, prev: m };
    onChange(clampMinutes(hourOffset + m, maxMinutes));
  };

  const onUp = () => {
    drag.current = null;
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!onChange) return;
    const step = e.shiftKey ? 5 : 1;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") onChange(clampMinutes(minutes + step, maxMinutes));
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") onChange(clampMinutes(minutes - step, maxMinutes));
    else return;
    e.preventDefault();
  };

  return (
    <svg
      ref={svg}
      className={onChange ? "dial interactive" : "dial"}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role={onChange ? "slider" : "img"}
      aria-label={label}
      aria-valuemin={onChange ? 1 : undefined}
      aria-valuemax={onChange ? maxMinutes : undefined}
      aria-valuenow={onChange ? Math.round(minutes) : undefined}
      tabIndex={onChange ? 0 : undefined}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onKeyDown={onKey}
    >
      <defs>
        <radialGradient id="dial-sheen" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {ticks.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} className={t.cls} />
      ))}
      <circle cx={C} cy={C} r={FACE} className="dial-face" />
      {fraction > 0 && (
        <>
          <path d={slicePath(C, C, FACE, fraction)} fill={color} />
          <path d={slicePath(C, C, FACE, fraction)} fill="url(#dial-sheen)" />
        </>
      )}
      <line x1={C} y1={C} x2={C} y2={C - FACE - 20} stroke={color} strokeWidth="6" strokeLinecap="round" />
      <circle cx={C} cy={C} r="16" className="dial-knob" />
    </svg>
  );
}
