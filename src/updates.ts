import { useCallback, useEffect, useRef, useState } from "react";
import { Channel, invoke, isTauri } from "@tauri-apps/api/core";

// Updates for the desktop app, through the shell (src-tauri/src/updates.rs).
// Published "Stint vX.Y.Z" releases, plus the "PR #N test" builds of open pull
// requests when Test builds is on. The web demo never updates.

export const updatesAvailable = isTauri;

/** How often a Stint left open in the tray looks again. */
const RECHECK_MS = 6 * 60 * 60 * 1000;

export type UpdateState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "latest" }
  | { phase: "available"; version: string; test: number | null }
  /** `fraction` is null while the size is unknown. */
  | { phase: "downloading"; version: string; test: number | null; fraction: number | null }
  | { phase: "installing"; version: string; test: number | null }
  | { phase: "failed"; during: "check" | "install"; version?: string; test?: number | null };

/** The "PR #N test" pre-release of an open pull request. */
export type TestBuild = { pr: number; title: string; version: string; built: string };

/** The pull request a test build's version (1.4.4-pr.49.120) came from, or null for a release. */
export function testOf(version: string): number | null {
  const m = /-pr\.(\d+)\./.exec(version);
  return m ? Number(m[1]) : null;
}

type Found = { version: string; notes: string; test: number | null };
type Progress = { event: "downloading"; data: { done: number; total: number | null } } | { event: "installing" };

export type Updater = {
  state: UpdateState;
  /** Stint's own version, once known. */
  current: string;
  /** The open test builds, newest first, while Test builds is on (null until fetched). */
  tests: TestBuild[] | null;
  /** Looks for an update and says what it found; installing waits for a click. */
  checkNow(): void;
  install(): void;
  /** Installs one particular test build. */
  installTest(pr: number): void;
};

/**
 * Keeps track of updates. With `auto` on it checks quietly when Stint opens and
 * every few hours, and only reports what it found: installing restarts Stint,
 * so that waits for a click.
 *
 * With `testBuilds` on, a check offers the newest open test build (the PR
 * pushed most recently), or the release when there is none. With it off, a
 * Stint on a test build is offered the release, to go back to it.
 */
export function useUpdater(auto: boolean, testBuilds: boolean): Updater {
  const [state, setState] = useState<UpdateState>({ phase: "idle" });
  const [current, setCurrent] = useState("");
  const [tests, setTests] = useState<TestBuild[] | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!isTauri()) return;
    import("@tauri-apps/api/app")
      .then((a) => a.getVersion())
      .then(setCurrent)
      .catch(() => {});
  }, []);

  const install = useCallback((version: string, test: number | null) => {
    busy.current = true;
    setState({ phase: "downloading", version, test, fraction: null });
    const progress = new Channel<Progress>();
    progress.onmessage = (p) =>
      setState(
        p.event === "installing"
          ? { phase: "installing", version, test }
          : {
              phase: "downloading",
              version,
              test,
              fraction: p.data.total ? Math.min(1, p.data.done / p.data.total) : null,
            },
      );
    invoke("update_install", { progress }).catch(() => {
      busy.current = false;
      setState({ phase: "failed", during: "install", version, test });
    });
  }, []);

  /**
   * `quiet` checks leave the card as it was when nothing is found or the check
   * fails. `pr` asks for that test build; otherwise Test builds decides.
   */
  const check = useCallback(
    async (quiet: boolean, thenInstall: boolean, pr?: number) => {
      if (!isTauri() || busy.current) return;
      busy.current = true;
      if (!quiet) setState({ phase: "checking" });
      try {
        let test: number | null = pr ?? null;
        if (testBuilds && pr === undefined) {
          const list = await invoke<TestBuild[]>("update_test_builds");
          setTests(list);
          test = list[0]?.pr ?? null;
        }
        const found = await invoke<Found | null>("update_check", { test });
        busy.current = false;
        if (found && thenInstall) install(found.version, found.test);
        else if (found) setState({ phase: "available", version: found.version, test: found.test });
        else if (!quiet) setState({ phase: "latest" });
      } catch {
        busy.current = false;
        if (!quiet) setState({ phase: "failed", during: "check" });
      }
    },
    [install, testBuilds],
  );

  // Turning Test builds on lists them straight away; off forgets them, and
  // anything found under the other setting no longer applies.
  useEffect(() => {
    if (!isTauri() || busy.current) return;
    setState({ phase: "idle" });
    if (!testBuilds) {
      setTests(null);
      return;
    }
    invoke<TestBuild[]>("update_test_builds")
      .then(setTests)
      .catch(() => setTests([]));
  }, [testBuilds]);

  useEffect(() => {
    if (!auto) return;
    void check(true, false);
    const id = setInterval(() => void check(true, false), RECHECK_MS);
    return () => clearInterval(id);
  }, [auto, check]);

  return {
    state,
    current,
    tests,
    checkNow: () => void check(false, false),
    install: () => {
      if (state.phase === "available" || (state.phase === "failed" && state.version))
        install(state.version!, state.test ?? null);
    },
    installTest: (pr) => void check(false, true, pr),
  };
}
