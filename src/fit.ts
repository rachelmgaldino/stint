// Stint is drawn for a 1440x900 window. In a bigger window it stays that size
// and the cards get the extra room; in a smaller one the whole app zooms out so
// nothing spills off the bottom. The Size setting (Ctrl + / Ctrl −) scales it
// up or down from there, in percent.
// Phones (640px and below) keep their own layout at 1x.

export const BASE_WIDTH = 1440;
export const BASE_HEIGHT = 900;
const MIN = 0.6;
const MAX = 1.6;

export const SIZE_MIN = 70;
export const SIZE_MAX = 150;
export const SIZE_STEP = 10;

/** Keeps a saved Size on the 70–150% scale, in 10% steps. */
export function cleanSize(size: unknown): number {
  const n = typeof size === "number" && Number.isFinite(size) ? size : 100;
  return Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(n / SIZE_STEP) * SIZE_STEP));
}

export function fitScale(width: number, height: number, size = 100): number {
  if (width <= 640) return 1;
  const fit = Math.min(1, width / BASE_WIDTH, height / BASE_HEIGHT);
  const s = Math.max(0.7, fit) * (cleanSize(size) / 100);
  return Math.round(Math.min(MAX, Math.max(MIN, s)) * 1000) / 1000;
}

let size = 100;
let apply = () => {};

export function setUiSize(next: number): void {
  size = next;
  apply();
}

export function startFitting(): void {
  const root = document.documentElement;
  apply = () => {
    const s = fitScale(innerWidth, innerHeight, size);
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
