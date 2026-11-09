import { useCallback, useEffect, useRef, useState } from "react";
import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import { t } from "./i18n";

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
  /**
   * `back`: installing the release takes a test build back to the release it
   * was made on. `why` says why a test build with Test builds on is offered
   * the release: its pull request is in it, or was closed without merging.
   */
  | { phase: "available"; version: string; test: number | null; back: boolean; why?: "released" | "closed" }
  /** On a test build of `pr`, still open, with no build on the newest release yet. */
  | { phase: "waiting"; pr: number; release: string | null }
  /** On a test build of `pr`, merged, before the release that ships it is out. */
  | { phase: "merged"; pr: number }
  /** `fraction` is null while the size is unknown. */
  | { phase: "downloading"; version: string; test: number | null; fraction: number | null }
  | { phase: "installing"; version: string; test: number | null }
  | { phase: "failed"; during: "check" | "install"; version?: string; test?: number | null };

/**
 * The "PR #N test" pre-release of an open pull request. `before` is the newest
 * release when the build was made before it: only the installed build is
 * listed then.
 */
export type TestBuild = { pr: number; title: string; version: string; built: string; before: string | null };

/** What update_test_builds reads from the releases. */
export type TestBuilds = {
  /** The newest release, null before the first. */
  release: string | null;
  /** Newest first. */
  builds: TestBuild[];
  /** Whether a release's notes list the pull request of the installed test build. */
  released: boolean;
};

/** How a pull request stands on GitHub (update_pull_state). */
export type PullState = "open" | "merged" | "closed";

/** What update_check found. */
export type Found = { version: string; notes: string; test: number | null };

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

/**
 * What a check asks once it has the list. `test` is the pull request whose
 * build update_check looks at, null for the release: with Test builds on and
 * on a test build, its own pull request while it has a build on the newest
 * release (a newer one, if any). On a release, the release: other test builds
 * are installed from the list. `pull` is the pull request to ask GitHub about,
 * with Test builds on, only when its build can't tell (gone, or made before
 * the newest release) and no release lists it.
 */
export function whatToAsk(
  current: string,
  list: TestBuilds,
  testBuilds: boolean,
): { test: number | null; pull: number | null } {
  const pr = testOf(current);
  if (!testBuilds || pr === null) return { test: null, pull: null };
  const fresh = list.builds.some((b) => b.pr === pr && b.before === null);
  return { test: fresh ? pr : null, pull: !fresh && !list.released ? pr : null };
}

/**
 * Where a check leaves the card, from what it learned: what update_check found
 * (null when nothing, or not asked), and on a test build, the list and how its
 * pull request stands (when `whatToAsk` asked).
 */
export function outcome(current: string, found: Found | null, list?: TestBuilds, pull?: PullState): UpdateState {
  const pr = testOf(current);
  if (pr !== null && pull === "open") return { phase: "waiting", pr, release: list?.release ?? null };
  if (pr !== null && pull === "merged") return { phase: "merged", pr };
  if (!found) return { phase: "latest" };
  const offer = { phase: "available", version: found.version, test: found.test } as const;
  if (pr === null || found.test !== null) return { ...offer, back: false };
  // The release that ships the pull request is never a step back.
  if (list?.released) return { ...offer, back: false, why: "released" };
  const back = goesBack(found.version, current);
  return pull === "closed" ? { ...offer, back, why: "closed" } : { ...offer, back };
}

/** Something to install, as the card and the pill show it. */
export type Offer = Extract<UpdateState, { phase: "available" }>;

/** The card's words for an offer; on a test build they say what installing the release does to it. */
export function offerText(offer: Offer, current: string): string {
  const text = t().settings;
  const pr = testOf(current);
  if (offer.test !== null) return text.updateAvailableTest(offer.test);
  if (pr === null) return text.updateAvailable(offer.version);
  if (offer.why === "released") return text.updateInRelease(pr, offer.version);
  const release = offer.back ? text.updateBack(offer.version) : text.updateLeave(offer.version, pr);
  return offer.why === "closed" ? `${text.updateClosed(pr)} ${release}` : release;
}

/** The title bar pill's words for an offer. */
export function pillText(offer: Offer): string {
  const text = t().updatePill;
  if (offer.test !== null) return text.readyTest(offer.test);
  return offer.back ? text.back(offer.version) : text.ready(offer.version);
}

/** Opens a pull request's page on GitHub, to review or merge it. */
export function openPullRequest(pr: number) {
  if (isTauri()) invoke("open_pull_request", { pr }).catch(() => {});
}

type Progress = { event: "downloading"; data: { done: number; total: number | null } } | { event: "installing" };

export type Updater = {
  state: UpdateState;
  /** Stint's own version, once known. */
  current: string;
  /**
   * The open test builds made on the newest release, plus the installed one,
   * newest first, while Test builds is on (null until fetched).
   */
  tests: TestBuild[] | null;
  /** When a check last got an answer, null before the first. */
  checked: number | null;
  /** Whether a check is running, quiet ones too (the status says so only for the others). */
  checking: boolean;
  /**
   * Looks for an update and says what it found, listing the test builds again
   * while Test builds is on; installing waits for a click.
   */
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
 * With `testBuilds` on, a check follows the build Stint is on (`whatToAsk`,
 * `outcome`): a newer build of the same pull request; once it has none on the
 * newest release, it waits for one while the pull request is open, waits for
 * the release once merged, and offers the release once that is out or the
 * pull request was closed. From a release, only newer releases. With it off,
 * a Stint on a test build is offered the release; the release notes still say
 * whether that release ships its pull request.
 */
export function useUpdater(auto: boolean, testBuilds: boolean): Updater {
  const [state, setState] = useState<UpdateState>({ phase: "idle" });
  const [current, setCurrent] = useState("");
  const [tests, setTests] = useState<TestBuild[] | null>(null);
  const [checked, setChecked] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
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
   * `quiet` checks don't show "Checking" and leave the card as it was when the
   * check fails; what they find shows as usual. `pr` asks for that test build
   * and null for the release; otherwise Test builds decides.
   */
  const check = useCallback(
    async (quiet: boolean, thenInstall: boolean, pr?: number | null) => {
      if (!isTauri() || busy.current) return;
      busy.current = true;
      setChecking(true);
      if (!quiet) setState({ phase: "checking" });
      try {
        let found: Found | null;
        let list: TestBuilds | undefined;
        let pull: PullState | undefined;
        let asked: boolean;
        // Looks again if Test builds was switched meanwhile: what it found was for the other setting.
        do {
          asked = withTests.current;
          let test = pr ?? null;
          list = undefined;
          pull = undefined;
          // On a test build the release notes say whether its pull request shipped, whatever Test builds says.
          if (pr === undefined && (asked || testOf(current) !== null)) {
            list = await invoke<TestBuilds>("update_test_builds");
            if (asked && withTests.current) setTests(list.builds);
            const ask = whatToAsk(current, list, asked);
            test = ask.test;
            if (ask.pull !== null) pull = await invoke<PullState>("update_pull_state", { pr: ask.pull });
          }
          // An open or merged pull request has nothing to install yet.
          found = pull === "open" || pull === "merged" ? null : await invoke<Found | null>("update_check", { test });
        } while (pr === undefined && asked !== withTests.current);
        busy.current = false;
        setChecked(Date.now());
        const next = outcome(current, found, list, pull);
        if (found && thenInstall) install(found.version, found.test);
        // This replaces an earlier offer too: the shell no longer holds it (its build may be gone).
        // A download started from that offer while a quiet check ran keeps its card.
        else setState((s) => (s.phase === "downloading" || s.phase === "installing" ? s : next));
      } catch {
        busy.current = false;
        if (!quiet) setState({ phase: "failed", during: "check" });
      } finally {
        setChecking(false);
      }
    },
    [install, current],
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
    invoke<TestBuilds>("update_test_builds")
      .then((l) => setTests(l.builds))
      .catch(() => setTests([]));
  }, [testBuilds]);

  // Switching Test builds changes what a check finds, so it looks again then too.
  // What it offers depends on the build Stint is on, so it waits for the version.
  useEffect(() => {
    if (!auto || !current) return;
    void check(true, false);
    const id = setInterval(() => void check(true, false), RECHECK_MS);
    return () => clearInterval(id);
  }, [auto, testBuilds, current, check]);

  return {
    state,
    current,
    tests,
    checked,
    checking,
    checkNow: () => void check(false, false),
    install: () => {
      if (state.phase === "available") install(state.version, state.test);
      // The failed try used up what was found, and it may be gone by now, so look for it again.
      else if (state.phase === "failed" && state.during === "install") void check(false, true, state.test ?? null);
    },
    installTest: (pr) => void check(false, true, pr),
  };
}
