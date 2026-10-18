// Stint is drawn for a 1200x760 window and then zoomed to fill whatever window
// it's in, so text and cards grow on a big monitor and shrink on a laptop
// instead of spilling off the bottom. Phones (640px and below) keep their own
// layout at 1x.

export const BASE_WIDTH = 1200;
export const BASE_HEIGHT = 760;
const MIN = 0.7;
const MAX = 1.8;

export function fitScale(width: number, height: number): number {
  if (width <= 640) return 1;
  const s = Math.min(width / BASE_WIDTH, height / BASE_HEIGHT);
  return Math.round(Math.min(MAX, Math.max(MIN, s)) * 1000) / 1000;
}

export function startFitting(): void {
  const root = document.documentElement;
  const apply = () => {
    const s = fitScale(innerWidth, innerHeight);
    const w = innerWidth / s;
    root.style.setProperty("--s", String(s));
    // Layout width after zooming, for the few rules that change with width.
    root.toggleAttribute("data-narrow", w <= 1080);
    root.toggleAttribute("data-narrower", w <= 860);
    root.toggleAttribute("data-short", innerHeight / s <= 700);
  };
  apply();
  addEventListener("resize", apply);
}
