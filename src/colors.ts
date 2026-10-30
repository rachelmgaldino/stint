// Stint's soft palette. Category colours picked before the redesign can be
// bright, so they are softened toward white wherever they fill a shape.

/** Colours offered for new categories. */
export const palette = ["#f4a988", "#a7aeec", "#b9d9a9", "#f1b5c9", "#f3db8e", "#add6e8", "#c9b6e4"];

/** A category colour as a pastel fill. Already-soft colours barely change. */
export function soft(color: string): string {
  return `color-mix(in oklab, ${color} 60%, #ffffff)`;
}

/** A "#rrggbb" colour the way Windows stores it: 0x00bbggrr. */
export function colorRef(hex: string): number {
  const rgb = parseInt(hex.slice(1), 16);
  return ((rgb & 0xff) << 16) | (rgb & 0xff00) | (rgb >> 16);
}

/** Whether a "#rrggbb" colour is dark enough to need light text on it. */
export function isDark(hex: string): boolean {
  const rgb = parseInt(hex.slice(1), 16);
  return ((rgb >> 16) * 299 + ((rgb >> 8) & 0xff) * 587 + (rgb & 0xff) * 114) / 1000 < 128;
}
