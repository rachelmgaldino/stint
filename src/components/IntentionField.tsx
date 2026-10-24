import { useMemo, useState } from "react";
import type { Category } from "../store";
import { soft } from "../colors";
import { addDays, startOfDay } from "../dates";
import { fold, matching, recentFor, type PastIntention } from "../intentions";
import { t } from "../i18n";

type Props = {
  value: string;
  categoryId: number | null;
  categories: Category[];
  past: PastIntention[];
  now: number;
  onChange(v: string): void;
  onPick(text: string, categoryId: number | null): void;
  /** Shown above the field; the plan card's "Intention" when left out. */
  label?: string;
  autoFocus?: boolean;
  placeholder?: string;
  /** false: no recent chips; tapping the empty field lists them instead, as on a phone. */
  chips?: boolean;
  /** Enter with no suggestion open, or leaving the field (unless `doneOnBlur` is false). */
  onDone?(): void;
  /** false: leaving the field doesn't count as done, only Enter does. */
  doneOnBlur?: boolean;
  /** Escape with no suggestion open. */
  onCancel?(): void;
};

/** "today", "yesterday" or dd/mm. */
function when(ms: number, now: number): string {
  const day = startOfDay(ms);
  const today = startOfDay(now);
  if (day === today) return t().timer.today;
  if (day === addDays(today, -1)) return t().timer.yesterday;
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Bolds the part of `text` that matches what was typed. */
function highlight(text: string, query: string) {
  const at = fold(text).indexOf(fold(query));
  if (!query.trim() || at < 0) return text;
  const end = at + query.trim().length;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, end)}</mark>
      {text.slice(end)}
    </>
  );
}

export function IntentionField(p: Props) {
  const text = t().timer;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const empty = !p.value.trim();
  const category = p.categories.find((c) => c.id === p.categoryId);
  const recent = useMemo(() => recentFor(p.past, p.categoryId), [p.past, p.categoryId]);
  const found = useMemo(() => matching(p.past, p.value), [p.past, p.value]);
  // The list under the field: what matches while typing, or (on a phone, where
  // the chips don't fit) the recent ones while it's empty.
  const rows = empty ? recent : found;
  const showList = open && rows.length > 0;
  const catOf = (i: PastIntention) => p.categories.find((c) => c.id === i.categoryId);

  const pick = (i: PastIntention) => {
    p.onPick(i.text, catOf(i) ? i.categoryId : p.categoryId);
    setOpen(false);
  };

  return (
    <div className={`field intention-field${empty ? " is-empty" : ""}`}>
      <span>{p.label ?? text.intention}</span>
      <div className="intention-box">
        <input
          aria-label={text.intention}
          placeholder={p.placeholder ?? text.intentionPlaceholder}
          value={p.value}
          maxLength={120}
          role="combobox"
          aria-expanded={showList}
          aria-autocomplete="list"
          autoFocus={p.autoFocus}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            if (p.doneOnBlur !== false) p.onDone?.();
          }}
          onChange={(e) => {
            p.onChange(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (!showList) {
              if (e.key === "Enter" && p.onDone) {
                e.preventDefault();
                p.onDone();
              } else if (e.key === "Escape" && p.onCancel) p.onCancel();
              return;
            }
            if (e.key === "ArrowDown") setActive((a) => (a + 1) % rows.length);
            else if (e.key === "ArrowUp") setActive((a) => (a - 1 + rows.length) % rows.length);
            else if (e.key === "Enter") pick(rows[active]);
            else if (e.key === "Escape") setOpen(false);
            else return;
            e.preventDefault();
          }}
        />
        {showList && (
          <div className={`intention-list card${empty ? " recent-list" : ""}${p.chips === false ? " no-chips" : ""}`} role="listbox">
            {empty && <div className="intention-list-head">{text.recentIn(category?.name ?? "")}</div>}
            {rows.map((i, k) => {
              const c = catOf(i);
              return (
                <button
                  key={i.text}
                  role="option"
                  aria-selected={k === active}
                  className={k === active ? "intention-row active" : "intention-row"}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(k)}
                  onClick={() => pick(i)}
                >
                  <span className="dot" style={{ background: c ? soft(c.color) : "var(--line)" }} />
                  <span className="intention-row-text">{highlight(i.text, empty ? "" : p.value)}</span>
                  <span className="intention-row-meta">
                    {!empty && c && c.id !== p.categoryId ? `${c.name} · ` : ""}
                    {when(i.lastAt, p.now)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {empty && recent.length > 0 && p.chips !== false && (
        <div className="recent-chips" aria-label={text.recentIn(category?.name ?? "")}>
          <span className="recent-label">{text.recentIn(category?.name ?? "")}</span>
          <div className="recent-chip-row">
            {recent.map((i) => (
              <button key={i.text} className="recent-chip" onClick={() => pick(i)}>
                {i.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
