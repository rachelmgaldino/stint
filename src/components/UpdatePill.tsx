import { t } from "../i18n";
import { testOf, type Updater } from "../updates";

/** Beside the name while Stint runs a pull request's test build, so it's never mistaken for a release. */
export function TestTag({ current }: { current: string }) {
  const pr = testOf(current);
  if (pr === null) return null;
  const text = t().updatePill;
  return (
    <span className="test-tag" title={text.testHint(pr)}>
      {text.test(pr)}
    </span>
  );
}

/** Beside the name once the quiet check finds a new version; a click installs it. */
export function UpdatePill({ updater }: { updater: Updater }) {
  const { state } = updater;
  const text = t().updatePill;
  if (state.phase === "available") {
    return (
      <button type="button" className="update-pill" title={text.hint} onClick={updater.install}>
        {state.test !== null
          ? text.readyTest(state.test)
          : testOf(updater.current) !== null
            ? text.back(state.version)
            : text.ready(state.version)}
      </button>
    );
  }
  if (state.phase === "downloading" || state.phase === "installing") {
    const pct = state.phase === "downloading" && state.fraction !== null ? Math.round(state.fraction * 100) : null;
    return (
      <span className="update-pill busy" role="status">
        {text.updating(state.phase === "installing" ? 100 : pct)}
      </span>
    );
  }
  return null;
}
