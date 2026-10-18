// Geometry for the drag-to-set timer dial. One full turn is 60 minutes;
// dragging past 12 o'clock keeps adding (or removing) whole hours.

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
