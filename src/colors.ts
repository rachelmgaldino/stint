// Stint's soft palette. Category colours picked before the redesign can be
// bright, so they are softened toward white wherever they fill a shape.

/** Colours offered for new categories. */
export const palette = ["#f4a988", "#a7aeec", "#b9d9a9", "#f1b5c9", "#f3db8e", "#add6e8", "#c9b6e4"];

/** A category colour as a pastel fill. Already-soft colours barely change. */
export function soft(color: string): string {
  return `color-mix(in oklab, ${color} 60%, #ffffff)`;
}
