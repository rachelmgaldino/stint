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

/**
 * Whether installing the release `version` takes Stint back from `current`: true
 * for the release a test build was made on (1.10.3 under 1.10.4-pr.75.3), false
 * for the one that ships it (1.10.4) and anything later.
 */
export function goesBack(version: string, current: string): boolean {
  // X.Y.Z only: a release sorts above its own test builds, so equal means not back.
  const core = (v: string) => v.split("-")[0].split(".").map(Number);
  const [a, b] = [core(version), core(current)];
  const i = a.findIndex((n, k) => n !== b[k]);
  return i !== -1 && a[i] < b[i];
}

/** Opens a pull request's page on GitHub, to review or merge it. */
export function openPullRequest(pr: number) {
  if (isTauri()) invoke("open_pull_request", { pr }).catch(() => {});
}

type Found = { version: string; notes: string; test: number | null };
type Progress = { event: "downloading"; data: { done: number; total: number | null } } | { event: "installing" };

export type Updater = {
  state: UpdateState;
  /** Stint's own version, once known. */
  current: string;
  /**
   * The open test builds newer than the newest release, newest first, while
   * Test builds is on (null until fetched).
   */
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
 * pushed most recently) that is newer than the newest release, or the release
 * when there is none. With it off, a Stint on a test build is offered the
 * release, to go back to it.
 */
export function useUpdater(auto: boolean, testBuilds: boolean): Updater {
  const [state, setState] = useState<UpdateState>({ phase: "idle" });
  const [current, setCurrent] = useState("");
  const [tests, setTests] = useState<TestBuild[] | null>(null);
  const busy = useRef(false);
  // Read by a running check, so a switch while it looks is not lost.
  const withTests = useRef(testBuilds);

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
   * `quiet` checks leave the card as it was when the check fails, and when
   * nothing is found they only drop an earlier offer. `pr` asks for that test
   * build and null for the release; otherwise Test builds decides.
   */
  const check = useCallback(
    async (quiet: boolean, thenInstall: boolean, pr?: number | null) => {
      if (!isTauri() || busy.current) return;
      busy.current = true;
      if (!quiet) setState({ phase: "checking" });
      try {
        let found: Found | null;
        let asked: boolean;
        // Looks again if Test builds was switched meanwhile: what it found was for the other setting.
        do {
          asked = withTests.current;
          let test = pr ?? null;
          if (asked && pr === undefined) {
            const list = await invoke<TestBuild[]>("update_test_builds");
            if (withTests.current) setTests(list);
            test = list[0]?.pr ?? null;
          }
          found = await invoke<Found | null>("update_check", { test });
        } while (pr === undefined && asked !== withTests.current);
        busy.current = false;
        if (found && thenInstall) install(found.version, found.test);
        else if (found) setState({ phase: "available", version: found.version, test: found.test });
        else if (!quiet) setState({ phase: "latest" });
        // The shell no longer holds what an earlier check offered (its build may be gone).
        else setState((s) => (s.phase === "available" || s.phase === "failed" ? { phase: "idle" } : s));
      } catch {
        busy.current = false;
        if (!quiet) setState({ phase: "failed", during: "check" });
      }
    },
    [install],
  );

  // Turning Test builds on lists them straight away; off forgets them, and
  // anything found under the other setting no longer applies. A check still
  // running looks again by itself, and a download keeps its card.
  useEffect(() => {
    withTests.current = testBuilds;
    if (!isTauri()) return;
    setState((s) =>
      s.phase === "checking" || s.phase === "downloading" || s.phase === "installing" ? s : { phase: "idle" },
    );
    if (!testBuilds) {
      setTests(null);
      return;
    }
    invoke<TestBuild[]>("update_test_builds")
      .then(setTests)
      .catch(() => setTests([]));
  }, [testBuilds]);

  // Switching Test builds changes what a check finds, so it looks again then too.
  useEffect(() => {
    if (!auto) return;
    void check(true, false);
    const id = setInterval(() => void check(true, false), RECHECK_MS);
    return () => clearInterval(id);
  }, [auto, testBuilds, check]);

  return {
    state,
    current,
    tests,
    checkNow: () => void check(false, false),
    install: () => {
      if (state.phase === "available") install(state.version, state.test);
      // The failed try used up what was found, and it may be gone by now, so look for it again.
      else if (state.phase === "failed" && state.during === "install") void check(false, true, state.test ?? null);
    },
    installTest: (pr) => void check(false, true, pr),
  };
}
