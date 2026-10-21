import { useCallback, useEffect, useRef, useState } from "react";
import { Channel, invoke, isTauri } from "@tauri-apps/api/core";

// Updates for the desktop app, through the shell (src-tauri/src/updates.rs).
// Only published "Stint vX.Y.Z" releases count; the web demo never updates.

export const updatesAvailable = isTauri;

/** How often a Stint left open in the tray looks again. */
const RECHECK_MS = 6 * 60 * 60 * 1000;

export type UpdateState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "latest" }
  | { phase: "available"; version: string }
  /** `fraction` is null while the size is unknown. */
  | { phase: "downloading"; version: string; fraction: number | null }
  | { phase: "installing"; version: string }
  | { phase: "failed"; during: "check" | "install"; version?: string };

type Found = { version: string; notes: string };
type Progress = { event: "downloading"; data: { done: number; total: number | null } } | { event: "installing" };

export type Updater = {
  state: UpdateState;
  /** Stint's own version, once known. */
  current: string;
  /** Looks for an update and, when there is one, installs it straight away. */
  checkAndInstall(): void;
  install(): void;
};

/**
 * Keeps track of updates. With `auto` on it checks quietly when Stint opens and
 * every few hours, and only reports what it found: installing restarts Stint,
 * so that waits for a click.
 */
export function useUpdater(auto: boolean): Updater {
  const [state, setState] = useState<UpdateState>({ phase: "idle" });
  const [current, setCurrent] = useState("");
  const busy = useRef(false);

  useEffect(() => {
    if (!isTauri()) return;
    import("@tauri-apps/api/app")
      .then((a) => a.getVersion())
      .then(setCurrent)
      .catch(() => {});
  }, []);

  const install = useCallback((version: string) => {
    busy.current = true;
    setState({ phase: "downloading", version, fraction: null });
    const progress = new Channel<Progress>();
    progress.onmessage = (p) =>
      setState(
        p.event === "installing"
          ? { phase: "installing", version }
          : { phase: "downloading", version, fraction: p.data.total ? Math.min(1, p.data.done / p.data.total) : null },
      );
    invoke("update_install", { progress }).catch(() => {
      busy.current = false;
      setState({ phase: "failed", during: "install", version });
    });
  }, []);

  /** `quiet` checks leave the card as it was when nothing is found or the check fails. */
  const check = useCallback(
    async (quiet: boolean, thenInstall: boolean) => {
      if (!isTauri() || busy.current) return;
      busy.current = true;
      if (!quiet) setState({ phase: "checking" });
      try {
        const found = await invoke<Found | null>("update_check");
        busy.current = false;
        if (found && thenInstall) install(found.version);
        else if (found) setState({ phase: "available", version: found.version });
        else if (!quiet) setState({ phase: "latest" });
      } catch {
        busy.current = false;
        if (!quiet) setState({ phase: "failed", during: "check" });
      }
    },
    [install],
  );

  useEffect(() => {
    if (!auto) return;
    void check(true, false);
    const id = setInterval(() => void check(true, false), RECHECK_MS);
    return () => clearInterval(id);
  }, [auto, check]);

  return {
    state,
    current,
    checkAndInstall: () => void check(false, true),
    install: () => {
      if (state.phase === "available" || (state.phase === "failed" && state.version)) install(state.version!);
    },
  };
}
