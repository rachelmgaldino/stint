// Geometry for the drag-to-set timer dial. One full turn is 60 minutes;
// dragging past 12 o'clock keeps adding (or removing) whole hours, and each
// hour is drawn as its own lap around the ring.

/** Minutes past the hour (0 to <60) for a point, measured clockwise from 12 o'clock. */
export function minuteAt(dx: number, dy: number): number {
  let a = Math.atan2(dx, -dy);
  if (a < 0) a += 2 * Math.PI;
  return (a / (2 * Math.PI)) * 60;
}

/**
 * Follow a drag from `prev` to `next` (both minutes past the hour) and return
 * the new whole-hour offset, detecting when the pointer crosses 12 o'clock.
 */
export function nextHourOffset(hourOffset: number, prev: number, next: number): number {
  if (prev > 45 && next < 15) return hourOffset + 60;
  if (prev < 15 && next > 45) return hourOffset - 60;
  return hourOffset;
}

/** Which lap (1 = the first hour) `minutes` falls in, and how much of that lap is filled (0 to 1). */
export function lapAt(minutes: number): { lap: number; fraction: number } {
  const m = Math.max(0, minutes);
  const lap = Math.max(1, Math.ceil(m / 60));
  return { lap, fraction: (m - (lap - 1) * 60) / 60 };
}

export type DragState = {
  hourOffset: number;
  prev: number;
  /** Set while the drag has gone past an end of the range; the time stays at that end. */
  pinned: "min" | "max" | null;
};

/**
 * Follow one pointer move to `next` (minutes past the hour). Going past the
 * last lap parks the time at `maxMinutes`, and going back past 12 o'clock in
 * the first lap parks it at 1 minute, until the pointer crosses 12 o'clock
 * the other way again.
 */
export function dragStep(s: DragState, next: number, maxMinutes: number): { state: DragState; minutes: number } {
  const maxOffset = Math.floor((maxMinutes - 1) / 60) * 60;
  let { hourOffset, pinned } = s;
  const offset = nextHourOffset(hourOffset, s.prev, next);
  if (pinned === "max") {
    if (offset < hourOffset) pinned = null;
  } else if (pinned === "min") {
    if (offset > hourOffset) pinned = null;
  } else if (offset > maxOffset) {
    pinned = "max";
  } else if (offset < 0) {
    pinned = "min";
  } else {
    hourOffset = offset;
  }
  const state = { hourOffset, prev: next, pinned };
  if (pinned === "max") return { state, minutes: maxMinutes };
  if (pinned === "min") return { state, minutes: 1 };
  return { state, minutes: clampMinutes(hourOffset + next, maxMinutes) };
}

export function clampMinutes(m: number, max: number): number {
  return Math.min(max, Math.max(1, Math.round(m)));
}

// Fixed precision, without printing -0.000.
const fmt = (v: number) => (Math.round(v * 1000) / 1000 + 0).toFixed(3);

/** SVG path for a pie slice from 12 o'clock, clockwise, covering `fraction` of the circle. */
export function slicePath(cx: number, cy: number, r: number, fraction: number): string {
  if (fraction <= 0) return "";
  if (fraction >= 1) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
  }
  const a = fraction * 2 * Math.PI;
  const x = cx + r * Math.sin(a);
  const y = cy - r * Math.cos(a);
  const large = fraction > 0.5 ? 1 : 0;
  return `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${fmt(x)} ${fmt(y)} Z`;
}
