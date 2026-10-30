import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { soft } from "../colors";
import type { FloatState } from "../float";
import { t } from "../i18n";
import { fold } from "../intentions";
import { IntentionField } from "./IntentionField";

type Props = {
  state: FloatState;
  now: number;
  /** On the dev preview page there's no window to hold open. */
  preview?: boolean;
  onStart(name: string, categoryId: number | null): void;
  onCancel(): void;
};

/**
 * Next task on the floating timer: names the next task without opening Stint,
 * while the timer keeps going. It holds the timer open and takes the keyboard
 * through float_naming in float.rs for as long as it shows, and goes away if
 * another app is clicked.
 */
export function FloatNext({ state, now, preview, onStart, onCancel }: Props) {
  const text = t().timer;
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(state.categoryId);
  const root = useRef<HTMLDivElement>(null);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;

  useEffect(() => {
    if (preview) return;
    // Focus can blink while the window takes the keyboard, so losing it only
    // counts once it stays lost.
    let wait = 0;
    const away = () => {
      clearTimeout(wait);
      wait = window.setTimeout(() => {
        if (!document.hasFocus()) cancel.current();
      }, 200);
    };
    window.addEventListener("blur", away);
    // The window only takes the keyboard here, after the field has mounted,
    // so autoFocus alone isn't enough.
    invoke("float_naming", { naming: true })
      .then(() => root.current?.querySelector("input")?.focus())
      .catch(() => {});
    return () => {
      clearTimeout(wait);
      window.removeEventListener("blur", away);
      void invoke("float_naming", { naming: false }).catch(() => {});
    };
  }, []);

  // Escape leaves at once: IntentionField would close its list first, and
  // on an empty field that list isn't even showing here.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    onCancel();
  };

  // The task just finished isn't offered again.
  const named = state.intention.trim();
  const past = named ? state.past.filter((i) => fold(i.text) !== fold(named)) : state.past;

  return (
    <div className="float-next" ref={root} onKeyDownCapture={onKeyDown}>
      <IntentionField
        value={name}
        categoryId={categoryId}
        categories={state.categories}
        past={past}
        now={now}
        label={text.whatsNext}
        placeholder={text.nextPlaceholder}
        autoFocus
        doneOnBlur={false}
        onChange={setName}
        onPick={onStart}
        onDone={() => (name.trim() ? onStart(name, categoryId) : onCancel())}
        onCancel={onCancel}
      />
      {state.categories.length > 1 && (
        <div className="float-next-cats" role="group" aria-label={text.category}>
          {state.categories.map((c) => (
            <button
              key={c.id}
              className="float-next-cat"
              title={c.name}
              aria-label={c.name}
              aria-pressed={c.id === categoryId}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setCategoryId(c.id)}
            >
              <span style={{ background: soft(c.color) }} />
            </button>
          ))}
        </div>
      )}
      <p className="float-next-hint">{t().float.nextHint}</p>
    </div>
  );
}
