import type { SessionRecord } from "./store";

// Past intentions, offered again in the plan card: the recent ones for the
// picked category while the field is empty, and matches from every category
// while typing. A task done in more than one category remembers each, so
// picking it keeps the category you're in when it was ever done there.

/** How a past intention was used in one category. */
export type CategoryUse = {
  categoryId: number | null;
  /** Focus sessions with this intention in this category in the last 30 days. */
  uses: number;
  lastAt: number;
};

export type PastIntention = {
  text: string;
  /** The category it was last used in. */
  categoryId: number | null;
  /** Focus sessions with this intention in the last 30 days, in every category. */
  uses: number;
  lastAt: number;
  /** Every category it was used in. */
  byCategory: CategoryUse[];
};

const DAY = 86_400_000;

/** Lower case without accents, so "reuniao" finds "Reunião". */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** One entry per intention (ignoring case and accents), with the category it was last used in and every one it was used in. */
export function pastIntentions(sessions: SessionRecord[], now: number): PastIntention[] {
  const byText = new Map<string, PastIntention>();
  for (const s of sessions) {
    const text = s.intention.trim();
    if (s.kind !== "focus" || !text) continue;
    const key = fold(text);
    const recent = s.startedAt >= now - 30 * DAY ? 1 : 0;
    let known = byText.get(key);
    if (!known) {
      known = { text, categoryId: s.categoryId, uses: 0, lastAt: s.startedAt, byCategory: [] };
      byText.set(key, known);
    } else if (s.startedAt > known.lastAt) {
      Object.assign(known, { text, categoryId: s.categoryId, lastAt: s.startedAt });
    }
    known.uses += recent;
    const use = known.byCategory.find((u) => u.categoryId === s.categoryId);
    if (!use) known.byCategory.push({ categoryId: s.categoryId, uses: recent, lastAt: s.startedAt });
    else {
      use.uses += recent;
      use.lastAt = Math.max(use.lastAt, s.startedAt);
    }
  }
  return [...byText.values()];
}

/** True when the intention was ever used in this category. */
export function doneIn(i: PastIntention, categoryId: number | null): boolean {
  return i.byCategory.some((u) => u.categoryId === categoryId);
}

/**
 * The category a pick of `i` goes to: the selected one when `i` was ever done
 * there, so a task done in two categories stays in the one you're in; otherwise
 * the one it was last done in.
 */
export function categoryFor(i: PastIntention, selected: number | null): number | null {
  return doneIn(i, selected) ? selected : i.categoryId;
}

/** For the empty field: the last one done in this category first (to carry on), then the most used in it. */
export function recentFor(all: PastIntention[], categoryId: number | null, n = 4): PastIntention[] {
  const mine = all.flatMap((i) => {
    const use = i.byCategory.find((u) => u.categoryId === categoryId);
    return use ? [{ i, use }] : [];
  });
  const last = [...mine].sort((a, b) => b.use.lastAt - a.use.lastAt)[0];
  if (!last) return [];
  const rest = mine.filter((m) => m !== last).sort((a, b) => b.use.uses - a.use.uses || b.use.lastAt - a.use.lastAt);
  return [last, ...rest].slice(0, n).map((m) => m.i);
}

/** While typing (2 letters or more): words that start with what was typed, in any category. */
export function matching(all: PastIntention[], query: string, n = 5): PastIntention[] {
  const q = fold(query);
  if (q.length < 2) return [];
  const starts = (i: PastIntention) => fold(i.text).startsWith(q);
  return all
    .filter((i) => fold(i.text) !== q && ` ${fold(i.text).replace(/[-–/]/g, " ")}`.includes(` ${q}`))
    .sort((a, b) => Number(starts(b)) - Number(starts(a)) || b.uses - a.uses || b.lastAt - a.lastAt)
    .slice(0, n);
}
