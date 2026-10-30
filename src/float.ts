// The floating timer: a second desktop window that shows the running session
// while Stint is minimized or in the tray. The main window owns the timer and
// sends it a snapshot; the bubble sends back what was clicked.

import { useEffect, useRef } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Language } from "./i18n";
import type { PastIntention } from "./intentions";
import type { Look } from "./look";
import type { Category, FloatStyle, Theme } from "./store";
import type * as T from "./timer";

export const FLOAT_LABEL = "float";

export type FloatState = {
  timer: T.Timer;
  long: boolean;
  category: { name: string; color: string } | null;
  look: Look;
  theme: Theme;
  language: Language;
  onTop: boolean;
  style: FloatStyle;
  /** The task in hand, and what the Next task form offers. */
  intention: string;
  categoryId: number | null;
  categories: Category[];
  past: PastIntention[];
};

export type FloatAction =
  | "break"
  | "end"
  | "focus"
  | "open"
  | "pause"
  | "pin"
  | "resume"
  /** Next task: the one in hand ended at `at` and the session carries on with this one. */
  | { next: string; categoryId: number | null; at: number };

/** True inside the floating timer's own window. */
export function isFloatWindow(): boolean {
  if (!isTauri()) return false;
  const meta = (window as unknown as { __TAURI_INTERNALS__?: { metadata?: { currentWindow?: { label?: string } } } })
    .__TAURI_INTERNALS__?.metadata;
  return meta?.currentWindow?.label === FLOAT_LABEL;
}

/**
 * Keeps the floating timer in step with the main window: whether it may show,
 * whether it stays on top, and what it draws. Clicks on it come back through
 * `onAction`.
 */
export function useFloatTimer(state: FloatState, enabled: boolean, onAction: (a: FloatAction) => void): void {
  const latest = useRef(state);
  latest.current = state;
  const handler = useRef(onAction);
  handler.current = onAction;
  const active = enabled && state.timer.status !== "idle";

  useEffect(() => {
    if (!isTauri()) return;
    invoke("float_config", { active, onTop: state.onTop, style: state.style }).catch(() => {});
  }, [active, state.onTop, state.style]);

  useEffect(() => {
    if (!isTauri()) return;
    import("@tauri-apps/api/event").then(({ emitTo }) => emitTo(FLOAT_LABEL, "float-state", state)).catch(() => {});
  }, [state]);

  useEffect(() => {
    if (!isTauri()) return;
    let stop = false;
    const offs: (() => void)[] = [];
    import("@tauri-apps/api/event").then(async ({ listen, emitTo }) => {
      const a = await listen<FloatAction>("float-action", (e) => handler.current(e.payload));
      const b = await listen("float-ready", () => void emitTo(FLOAT_LABEL, "float-state", latest.current));
      offs.push(a, b);
      if (stop) offs.forEach((off) => off());
    });
    return () => {
      stop = true;
      offs.forEach((off) => off());
    };
  }, []);
}

/** Brings the main window back. */
export function openMain(): void {
  if (isTauri()) invoke("float_open").catch(() => {});
}

/** Puts the bubble back in its default corner. */
export function resetFloat(): void {
  if (isTauri()) invoke("float_reset").catch(() => {});
}
