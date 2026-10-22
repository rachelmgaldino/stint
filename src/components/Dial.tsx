import { useRef, type ReactNode } from "react";
import { clampMinutes, dragStep, lapAt, minuteAt, type DragState } from "../dial";
import { look } from "../look";
import { isProto, ProtoDialBack, ProtoDialOver, ProtoKnob } from "./ProtoLooks";

export type Lap = {
  /** Ring colour and the darker "lip" used for the knob's centre. */
  color: string;
  lip: string;
};

type Props = {
  /** Minutes shown by the ring. Each hour is one lap around it. */
  minutes: number;
  /** One colour per hour, in order; the last one repeats if there are more hours. */
  laps: Lap[];
  maxMinutes: number;
  /** Called with whole minutes while the user drags. Omit to make the dial read-only. */
  onChange?(minutes: number): void;
  label: string;
  /** Drawn in the middle of the flower: Pip and the clock. */
  children?: ReactNode;
};

const SIZE = 360;
const C = SIZE / 2;
const RING = 140;
const CIRCUMFERENCE = 2 * Math.PI * RING;

// A scalloped flower behind the ring.
const PETALS = "M180 2L189 5L197 11L204 17L212 21L220 21L229 17L239 15L248 16L255 21L260 30L264 39L270 45L278 48L288 49L298 50L306 54L310 62L311 72L312 82L315 90L321 96L330 100L339 105L344 112L345 121L343 131L339 140L339 148L343 156L349 163L355 171L358 180L355 189L349 197L343 204L339 212L339 220L343 229L345 239L344 248L339 255L330 260L321 264L315 270L312 278L311 288L310 298L306 306L298 310L288 311L278 312L270 315L264 321L260 330L255 339L248 344L239 345L229 343L220 339L212 339L204 343L197 349L189 355L180 358L171 355L163 349L156 343L148 339L140 339L131 343L121 345L112 344L105 339L100 330L96 321L90 315L82 312L72 311L62 310L54 306L50 298L49 288L48 278L45 270L39 264L30 260L21 255L16 248L15 239L17 229L21 220L21 212L17 204L11 197L5 189L2 180L5 171L11 163L17 156L21 148L21 140L17 131L15 121L16 112L21 105L30 100L39 96L45 90L48 82L49 72L50 62L54 54L62 50L72 49L82 48L90 45L96 39L100 30L105 21L112 16L121 15L131 17L140 21L148 21L156 17L163 11L171 5Z";

export function Dial({ minutes, laps, maxMinutes, onChange, label, children }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const { lap, fraction } = lapAt(minutes);
  const current = laps[Math.min(lap, laps.length) - 1];
  const below = lap > 1 ? laps[Math.min(lap - 1, laps.length) - 1] : null;
  // Stop just short of a full turn so the knob doesn't sit on the ring's start.
  const angle = (Math.min(59.5, fraction * 60) / 60) * 2 * Math.PI;
  const knob = { x: C + RING * Math.sin(angle), y: C - RING * Math.cos(angle) };
  // Mochi's dial is a round sticker with a stitched edge and a little sun for a knob.
  const mochi = look() === "mochi";
  const lk = look();
  const proto = isProto(lk) ? lk : null;

  const pointMinute = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    const scale = SIZE / r.width;
    return minuteAt((e.clientX - r.left) * scale - C, (e.clientY - r.top) * scale - C);
  };

  const onDown = (e: React.PointerEvent) => {
    if (!onChange) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const m = pointMinute(e);
    // Keep the current hours so grabbing a 90 minute timer doesn't reset it to 30.
    const hourOffset = Math.floor(Math.max(0, minutes - 0.5) / 60) * 60;
    drag.current = { hourOffset, prev: m, pinned: null };
    onChange(clampMinutes(hourOffset + m, maxMinutes));
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !onChange) return;
    const m = pointMinute(e);
    const { state, minutes: next } = dragStep(drag.current, m, maxMinutes);
    drag.current = state;
    onChange(next);
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
    <div
      ref={box}
      className={onChange ? "dial interactive" : "dial"}
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
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        {proto ? (
          <ProtoDialBack look={proto} />
        ) : mochi ? (
          <>
            <circle cx={C} cy={C} r="176" className="dial-petals" />
            <circle cx={C} cy={C} r="166" className="dial-stitch" />
          </>
        ) : (
          <path d={PETALS} className="dial-petals" />
        )}
        <circle cx={C} cy={C} r={RING} className="dial-track" />
        {below && <circle cx={C} cy={C} r={RING} className="dial-lap" stroke={below.color} />}
        {fraction > 0 && (
          <circle
            cx={C}
            cy={C}
            r={RING}
            className={below ? "dial-arc over" : "dial-arc"}
            stroke={current.color}
            strokeDasharray={`${(fraction * CIRCUMFERENCE).toFixed(1)} ${CIRCUMFERENCE.toFixed(1)}`}
            transform={`rotate(-90 ${C} ${C})`}
          />
        )}
        {proto && <ProtoDialOver look={proto} />}
        {onChange && proto && <ProtoKnob look={proto} x={knob.x} y={knob.y} lip={current.lip} />}
        {onChange && !proto && (
          <>
            <circle cx={knob.x} cy={knob.y} r="17" className="dial-knob" />
            {mochi ? (
              <>
                <circle cx={knob.x} cy={knob.y} r="13" className="dial-sun" stroke={current.lip} />
                <circle cx={knob.x} cy={knob.y} r="8" fill="#f3cb8b" />
              </>
            ) : (
              <circle cx={knob.x} cy={knob.y} r="9" fill={current.lip} />
            )}
          </>
        )}
        <circle cx={C} cy={C} r="112" className="dial-face" />
      </svg>
      <div className="dial-center">{children}</div>
    </div>
  );
}
