import type { SessionRecord } from "./store";

// Past intentions, offered again in the plan card: the recent ones for the
// picked category while the field is empty, and matches from every category
// while typing.

export type PastIntention = {
  text: string;
  categoryId: number | null;
  /** Focus sessions with this intention in the last 30 days. */
  uses: number;
  lastAt: number;
};

const DAY = 86_400_000;

/** Lower case without accents, so "reuniao" finds "Reunião". */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** One entry per intention (ignoring case and accents), with the category it was last used in. */
export function pastIntentions(sessions: SessionRecord[], now: number): PastIntention[] {
  const byText = new Map<string, PastIntention>();
  for (const s of sessions) {
    const text = s.intention.trim();
    if (s.kind !== "focus" || !text) continue;
    const key = fold(text);
    const recent = s.startedAt >= now - 30 * DAY ? 1 : 0;
    const known = byText.get(key);
    if (!known) {
      byText.set(key, { text, categoryId: s.categoryId, uses: recent, lastAt: s.startedAt });
    } else {
      known.uses += recent;
      if (s.startedAt > known.lastAt) Object.assign(known, { text, categoryId: s.categoryId, lastAt: s.startedAt });
    }
  }
  return [...byText.values()];
}

/** For the empty field: the last one in this category first (to carry on), then the most used. */
export function recentFor(all: PastIntention[], categoryId: number | null, n = 4): PastIntention[] {
  const mine = all.filter((i) => i.categoryId === categoryId);
  const last = [...mine].sort((a, b) => b.lastAt - a.lastAt)[0];
  if (!last) return [];
  const rest = mine.filter((i) => i !== last).sort((a, b) => b.uses - a.uses || b.lastAt - a.lastAt);
  return [last, ...rest].slice(0, n);
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
