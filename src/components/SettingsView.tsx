import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { CalendarSettings, Category, Settings, Store, Theme } from "../store";
import { SIZE_MAX, SIZE_MIN, SIZE_STEP, cleanSize } from "../fit";
import * as G from "../google";
import { playSound, testNotification } from "../platform";
import { ratings } from "./Reflection";
import { RatingFace } from "./Pip";
import { palette, soft } from "../colors";
import {
  BellIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeft,
  ChevronRight,
  ChevronUpIcon,
  ClockIcon,
  GlobeIcon,
  GripIcon,
  SparkIcon,
  SunMoonIcon,
  TagIcon,
  XIcon,
} from "./icons";
import { languages, t } from "../i18n";
import type { Look } from "../look";
import { Pip } from "./Pip";
import { openPullRequest, testOf, updatesAvailable, type Updater } from "../updates";
import { resetFloat } from "../float";
import { clockTime, dayLabel } from "../dates";
import { isTauri } from "@tauri-apps/api/core";

type Props = {
  settings: Settings;
  categories: Category[];
  store: Store;
  google: { connected: boolean; calendars: G.GoogleCalendar[] };
  onGoogleChanged(): void;
  onSettings(s: Settings): void;
  onCategoriesChanged(): void;
  updater: Updater;
};

const themes: Theme[] = ["system", "light", "dark"];
const looks: Look[] = ["lavender", "mochi", "notebook", "riso"];

function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  sub,
  action,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  /** Indented under the switch it belongs to. */
  sub?: boolean;
  /** A small button shown beside the label, like "Test". */
  action?: ReactNode;
  onChange(v: number): void;
}) {
  const go = (d: number) => onChange(Math.min(max, Math.max(min, value + d)));
  return (
    <div className={sub ? "row sub-row" : "row"}>
      <span className="row-label">
        {label}
        {action}
      </span>
      <span className="stepper">
        <button
          type="button"
          aria-label={t().settings.less(label)}
          disabled={value <= min}
          onClick={() => go(-step)}
        >
          −
        </button>
        <span className="stepper-value" aria-live="polite">
          {value}
          {unit === "%" ? unit : ` ${unit}`}
        </span>
        <button
          type="button"
          aria-label={t().settings.more(label)}
          disabled={value >= max}
          onClick={() => go(step)}
        >
          +
        </button>
      </span>
    </div>
  );
}

function Switch({
  label,
  hint,
  checked,
  sub,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  sub?: boolean;
  onChange(v: boolean): void;
}) {
  return (
    <label className={sub ? "row sub-row" : "row"}>
      <span>
        {label}
        {hint && <span className="hint">{hint}</span>}
      </span>
      <span className="toggle">
        <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="switch" aria-hidden="true" />
      </span>
    </label>
  );
}

/** A setting with a few named options, as a small segmented control. */
function Choice<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: [V, string][];
  onChange(v: V): void;
}) {
  return (
    <div className="row choice-row">
      <span>{label}</span>
      <span className="segmented small" role="group" aria-label={label}>
        {options.map(([v, name]) => (
          <button key={v} aria-pressed={value === v} onClick={() => onChange(v)}>
            {name}
          </button>
        ))}
      </span>
    </div>
  );
}

type Tone = "apricot" | "lemon" | "bubblegum" | "peri" | "sky" | "matcha";

/** A rounded box of settings inside a section, with an optional small heading. */
function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="card settings-panel" aria-label={title}>
      {title && <h3>{title}</h3>}
      {children}
    </section>
  );
}

type SectionId = "rhythm" | "alerts" | "after" | "categories" | "calendar" | "look" | "app";

const phoneQuery = "(max-width: 640px)";
const isPhone = () => typeof matchMedia === "function" && matchMedia(phoneQuery).matches;

/** True while the window is phone-sized, where sections open as their own page. */
function usePhone() {
  const [phone, setPhone] = useState(isPhone);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const m = matchMedia(phoneQuery);
    const on = () => setPhone(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return phone;
}

export function SettingsView(p: Props) {
  const { settings } = p;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => p.onSettings({ ...settings, [k]: v });
  const text = t().settings;
  const notice = t().notice;
  const phone = usePhone();
  // On a phone the list comes first and a section opens as its own page.
  const [open, setOpen] = useState<SectionId | null>(() => (isPhone() ? null : "rhythm"));
  const shown = open ?? (phone ? null : "rhythm");
  const bodyRef = useRef<HTMLDivElement>(null);

  const go = (id: SectionId | null) => {
    setOpen(id);
    bodyRef.current?.scrollTo(0, 0);
    if (phone) scrollTo(0, 0);
  };

  const overflows: {
    on: "overflowFocus" | "overflowPause" | "overflowBreak";
    minutes: "overflowFocusMinutes" | "overflowPauseMinutes" | "overflowBreakMinutes";
    label: string;
    hint: string;
    test(n: number): void;
  }[] = [
    {
      on: "overflowFocus",
      minutes: "overflowFocusMinutes",
      label: text.overflowFocus,
      hint: text.overflowFocusHint,
      test: (n) => void testNotification(notice.overflowFocusTitle, notice.overflowFocusBody("", n)).catch(() => {}),
    },
    {
      on: "overflowPause",
      minutes: "overflowPauseMinutes",
      label: text.overflowPause,
      hint: text.overflowPauseHint,
      test: (n) => void testNotification(notice.pauseTitle, notice.pauseBody(true, "", n)).catch(() => {}),
    },
    {
      on: "overflowBreak",
      minutes: "overflowBreakMinutes",
      label: text.overflowBreak,
      hint: text.overflowBreakHint,
      test: (n) => void testNotification(notice.overflowBreakTitle, notice.overflowBreakBody(n)).catch(() => {}),
    },
  ];

  const alerts = [
    settings.notifyFocusEnd,
    settings.notifyBreakEnd,
    settings.sound,
    settings.notifySoon,
    settings.presence,
    settings.overflowFocus,
    settings.overflowPause,
    settings.overflowBreak,
  ];
  const cal = settings.calendar;
  const language = languages.find((l) => l.id === settings.language)?.name ?? "";
  const { current } = p.updater;
  const sections: { id: SectionId; name: string; summary: string; intro: string; tone: Tone; icon: ReactNode }[] = [
    {
      id: "rhythm",
      name: text.rhythm,
      summary: text.rhythmSummary(settings.focusMinutes, settings.breakMinutes, settings.longBreakMinutes),
      intro: text.rhythmIntro,
      tone: "apricot",
      icon: <ClockIcon />,
    },
    {
      id: "alerts",
      name: text.alerts,
      summary: text.alertsSummary(alerts.filter(Boolean).length, alerts.length),
      intro: text.alertsIntro,
      tone: "lemon",
      icon: <BellIcon />,
    },
    {
      id: "after",
      name: text.after,
      summary: settings.askReflection ? text.afterAsks : text.afterSkips,
      intro: text.afterSub,
      tone: "bubblegum",
      icon: <SparkIcon />,
    },
    {
      id: "categories",
      name: text.categories,
      summary: text.categoriesSummary(p.categories.map((c) => c.name)),
      intro: text.categoriesSub,
      tone: "sky",
      icon: <TagIcon />,
    },
    {
      id: "calendar",
      name: text.calendar,
      summary: !G.googleAvailable()
        ? text.calendarDesktopShort
        : !p.google.connected
          ? text.calendarOff
          : cal.syncSessions || cal.showEvents
            ? text.calendarSyncing
            : text.calendarConnected,
      intro: text.calendarSub,
      tone: "matcha",
      icon: <CalendarIcon />,
    },
    {
      id: "look",
      name: text.look,
      summary: `${text.looks[settings.look].name} · ${text.themeShort[settings.theme]}`,
      intro: text.lookIntro,
      tone: "peri",
      icon: <SunMoonIcon />,
    },
    {
      id: "app",
      name: text.app,
      summary: current ? `${language} · ${versionName(current)}` : language,
      intro: text.appIntro,
      tone: "lemon",
      icon: <GlobeIcon />,
    },
  ];
  const section = sections.find((x) => x.id === shown);

  const body = (id: SectionId) => {
    switch (id) {
      case "rhythm":
        return (
          <div className="settings-panels">
            <Panel title={text.lengths}>
              <Stepper
                label={text.focusLength}
                value={settings.focusMinutes}
                min={1}
                max={180}
                step={5}
                unit={text.min}
                onChange={(v) => set("focusMinutes", v)}
              />
              <Stepper
                label={text.breakLength}
                value={settings.breakMinutes}
                min={1}
                max={60}
                unit={text.min}
                onChange={(v) => set("breakMinutes", v)}
              />
              <Stepper
                label={text.longBreakLength}
                value={settings.longBreakMinutes}
                min={1}
                max={60}
                unit={text.min}
                onChange={(v) => set("longBreakMinutes", v)}
              />
              <Stepper
                label={text.longBreakAfter}
                value={settings.longBreakAfter}
                min={15}
                max={300}
                step={15}
                unit={text.min}
                onChange={(v) => set("longBreakAfter", v)}
              />
              <p className="card-note">{text.neverEnd}</p>
            </Panel>
            <div className="settings-panel-stack">
              <Panel title={text.dailyGoal}>
                <Stepper
                  label={text.goalPerDay}
                  value={settings.dailyGoal}
                  min={1}
                  max={20}
                  unit={text.sessions}
                  onChange={(v) => set("dailyGoal", v)}
                />
              </Panel>
              <Panel title={text.bigButtons}>
                <Choice
                  label={text.focusAction}
                  value={settings.focusAction}
                  options={[
                    ["break", text.focusActionBreak],
                    ["end", text.focusActionEnd],
                  ]}
                  onChange={(v) => set("focusAction", v)}
                />
                <Choice
                  label={text.breakAction}
                  value={settings.breakAction}
                  options={[
                    ["focus", text.breakActionFocus],
                    ["end", text.breakActionEnd],
                  ]}
                  onChange={(v) => set("breakAction", v)}
                />
              </Panel>
            </div>
          </div>
        );
      case "alerts":
        return (
          <div className="settings-panels">
            <Panel title={text.whenTimeUp}>
              <Switch
                label={text.notifyFocus}
                checked={settings.notifyFocusEnd}
                onChange={(v) => set("notifyFocusEnd", v)}
              />
              <Switch
                label={text.notifyBreak}
                checked={settings.notifyBreakEnd}
                onChange={(v) => set("notifyBreakEnd", v)}
              />
              <Switch label={text.sound} checked={settings.sound} onChange={(v) => set("sound", v)} />
              <Switch
                label={text.soon}
                hint={text.soonHint}
                checked={settings.notifySoon}
                onChange={(v) => set("notifySoon", v)}
              />
              {settings.notifySoon && (
                <>
                  <Stepper
                    sub
                    label={text.soonLength}
                    value={settings.soonMinutes}
                    min={1}
                    max={15}
                    unit={text.min}
                    onChange={(v) => set("soonMinutes", v)}
                  />
                  <Switch
                    sub
                    label={text.soonSound}
                    checked={settings.soonSound}
                    onChange={(v) => set("soonSound", v)}
                  />
                </>
              )}
              <TestButton />
            </Panel>
            <div className="settings-panel-stack">
              <Panel title={text.whileFocus}>
                <Switch
                  label={text.presence}
                  hint={text.presenceHint}
                  checked={settings.presence}
                  onChange={(v) => set("presence", v)}
                />
                {settings.presence && (
                  <Stepper
                    sub
                    label={text.presenceEvery}
                    action={<MiniButton label={text.listen} onClick={() => playSound("presence")} />}
                    value={settings.presenceMinutes}
                    min={1}
                    max={30}
                    unit={text.min}
                    onChange={(v) => set("presenceMinutes", v)}
                  />
                )}
              </Panel>
              <Panel title={text.whenRunsOver}>
                {overflows.map((o) => (
                  <div key={o.on} className="row-group">
                    <Switch label={o.label} hint={o.hint} checked={settings[o.on]} onChange={(v) => set(o.on, v)} />
                    {settings[o.on] && (
                      <Stepper
                        sub
                        label={text.notifyAfter}
                        action={<MiniButton label={text.test} onClick={() => o.test(settings[o.minutes])} />}
                        value={settings[o.minutes]}
                        min={1}
                        max={60}
                        unit={text.min}
                        onChange={(v) => set(o.minutes, v)}
                      />
                    )}
                  </div>
                ))}
              </Panel>
            </div>
          </div>
        );
      case "after":
        return (
          <div className="settings-panels one">
            <Panel>
              <Switch
                label={text.askReflection}
                hint={text.askReflectionHint}
                checked={settings.askReflection}
                onChange={(v) => set("askReflection", v)}
              />
              <div className="row">
                <span>{text.defaultMood}</span>
                <span className="segmented small" role="group" aria-label={text.defaultMood}>
                  <button aria-pressed={settings.defaultRating === 0} onClick={() => set("defaultRating", 0)}>
                    {text.none}
                  </button>
                  {ratings().map((r) => (
                    <button
                      key={r.value}
                      aria-pressed={settings.defaultRating === r.value}
                      aria-label={r.label}
                      title={r.label}
                      onClick={() => set("defaultRating", r.value)}
                    >
                      <RatingFace value={r.value} size={24} />
                    </button>
                  ))}
                </span>
              </div>
              <Switch
                label={text.autoBreak}
                checked={settings.autoBreak}
                onChange={(v) => set("autoBreak", v)}
              />
            </Panel>
          </div>
        );
      case "categories":
        return (
          <div className="settings-panels one">
            <Categories {...p} />
          </div>
        );
      case "calendar":
        return (
          <div className="settings-panels one">
            <CalendarSection {...p} set={(c) => set("calendar", c)} />
          </div>
        );
      case "look":
        return (
          <div className={isTauri() ? "settings-panels" : "settings-panels one"}>
            <Panel>
              <div className="look-picker" role="group" aria-label={text.look}>
                {looks.map((id) => (
                  <button
                    key={id}
                    className="look-option"
                    aria-pressed={settings.look === id}
                    onClick={() => set("look", id)}
                  >
                    <Pip size={36} as={id} />
                    <span>
                      {text.looks[id].name}
                      <small>{text.looks[id].sub}</small>
                    </span>
                  </button>
                ))}
              </div>
              <div className="theme-picker">
                {themes.map((id) => (
                  <button
                    key={id}
                    className={`theme-option ${id}`}
                    aria-pressed={settings.theme === id}
                    onClick={() => set("theme", id)}
                  >
                    <span className="theme-swatch">
                      <span />
                    </span>
                    {text.themeNames[settings.look][id]}
                  </button>
                ))}
              </div>
              <div className="desk-only">
                <Stepper
                  label={text.size}
                  value={cleanSize(settings.size)}
                  min={SIZE_MIN}
                  max={SIZE_MAX}
                  step={SIZE_STEP}
                  unit="%"
                  onChange={(v) => set("size", v)}
                />
                <p className="card-note">{text.sizeKeys}</p>
              </div>
            </Panel>
            {isTauri() && (
              <Panel title={text.floatTitle}>
                <Switch
                  label={text.floatOn}
                  hint={text.floatOnHint}
                  checked={settings.floatTimer}
                  onChange={(v) => set("floatTimer", v)}
                />
                {settings.floatTimer && (
                  <>
                    <Choice
                      label={text.floatStyle}
                      value={settings.floatStyle}
                      options={[
                        ["bubble", text.floatBubble],
                        ["pill", text.floatPill],
                      ]}
                      onChange={(v) => set("floatStyle", v)}
                    />
                    <Switch
                      sub
                      label={text.floatTop}
                      hint={text.floatTopHint}
                      checked={settings.floatOnTop}
                      onChange={(v) => set("floatOnTop", v)}
                    />
                    <div className="row sub-row">
                      <span>{settings.floatStyle === "pill" ? text.floatResetPill : text.floatReset}</span>
                      <MiniButton label={text.floatReset2} onClick={resetFloat} />
                    </div>
                  </>
                )}
              </Panel>
            )}
          </div>
        );
      case "app":
        return (
          <div className="settings-panels">
            <Panel title={text.language}>
              <div className="segmented language-picker" role="group" aria-label={text.language}>
                {languages.map((l) => (
                  <button
                    key={l.id}
                    lang={l.id}
                    aria-pressed={settings.language === l.id}
                    onClick={() => set("language", l.id)}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            </Panel>
            <UpdatesCard
              updater={p.updater}
              auto={settings.checkUpdates}
              onAuto={(v) => set("checkUpdates", v)}
              testBuilds={settings.testBuilds}
              onTestBuilds={(v) => set("testBuilds", v)}
            />
          </div>
        );
    }
  };

  return (
    <div className={section ? "shelf has-open" : "shelf"}>
      <nav className="shelf-nav" aria-label={text.title}>
        <h1 className="page-title">{text.title}</h1>
        <ul>
          {sections.map((x) => (
            <li key={x.id}>
              <button className="shelf-item" aria-current={shown === x.id ? "page" : undefined} onClick={() => go(x.id)}>
                <span className={`settings-icon ${x.tone}`}>{x.icon}</span>
                <span className="shelf-text">
                  <b>{x.name}</b>
                  <small>{x.summary}</small>
                </span>
                <span className="shelf-chevron" aria-hidden="true">
                  <ChevronRight />
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="shelf-foot">
          <Pip size={34} as={settings.look} />
          <span>{phone ? text.savedLocallyPhone : text.savedLocally}</span>
        </p>
      </nav>
      {section && (
        <div className="shelf-body" ref={bodyRef}>
          <button className="shelf-back" onClick={() => go(null)}>
            <ChevronLeft />
            {text.title}
          </button>
          <header className="shelf-head">
            <span className={`settings-icon big ${section.tone}`}>{section.icon}</span>
            <div>
              <h2>{section.name}</h2>
              <p className="settings-sub">{section.intro}</p>
            </div>
          </header>
          {body(section.id)}
        </div>
      )}
    </div>
  );
}

/** "Stint 1.4.3", or "Stint · PR #49 test" on a test build. */
function versionName(v: string): string {
  const pr = testOf(v);
  return pr === null ? t().settings.version(v) : t().settings.versionTest(pr);
}

function UpdatesCard({
  updater,
  auto,
  onAuto,
  testBuilds,
  onTestBuilds,
}: {
  updater: Updater;
  auto: boolean;
  onAuto(v: boolean): void;
  testBuilds: boolean;
  onTestBuilds(v: boolean): void;
}) {
  const text = t().settings;
  const { state, current, tests } = updater;
  const onTest = testOf(current);
  if (!updatesAvailable()) {
    return (
      <Panel title={text.updates}>
        <p className="muted">{text.updatesDesktopOnly}</p>
      </Panel>
    );
  }

  const pct = state.phase === "downloading" && state.fraction !== null ? Math.round(state.fraction * 100) : null;
  // Leaving a test build for the release is a step back, not an update.
  const back = state.phase === "available" && state.test === null && onTest !== null;
  const status =
    state.phase === "checking"
      ? text.updateChecking
      : state.phase === "latest"
        ? onTest !== null && testBuilds
          ? text.updateLatestTest
          : text.updateLatest
        : state.phase === "available"
          ? state.test !== null
            ? text.updateAvailableTest(state.test)
            : back
              ? text.updateBack(state.version)
              : text.updateAvailable(state.version)
          : state.phase === "downloading"
            ? text.updateDownloading(state.test !== null ? `PR #${state.test}` : state.version, pct)
            : state.phase === "installing"
              ? text.updateInstalling
              : state.phase === "failed"
                ? state.during === "check"
                  ? text.updateCheckFailed
                  : text.updateInstallFailed
                : text.updateIdle;
  const working = state.phase === "downloading" || state.phase === "installing";
  const ready = state.phase === "available" || (state.phase === "failed" && state.during === "install");

  return (
    <Panel title={text.updates}>
      <div className="row update-row" data-phase={state.phase}>
        <span>
          {versionName(current)}
          <span className="hint" role="status">
            {state.phase === "latest" && <span className="update-tick" aria-hidden />}
            {status}
          </span>
        </span>
        {ready ? (
          <button className="squishy small peri" onClick={updater.install}>
            {state.phase === "failed" ? text.tryAgain : back ? text.goBack : text.updateNow}
          </button>
        ) : (
          !working && (
            <button
              className="soft-button small"
              disabled={state.phase === "checking"}
              onClick={updater.checkNow}
            >
              {state.phase === "checking"
                ? text.checking
                : state.phase === "latest"
                  ? text.checkAgain
                  : state.phase === "failed"
                    ? text.tryAgain
                    : text.checkForUpdates}
            </button>
          )
        )}
      </div>
      {working && (
        <div
          className={`update-bar${state.phase === "installing" || pct === null ? " busy" : ""}`}
          role="progressbar"
          aria-valuenow={pct ?? undefined}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${state.phase === "installing" ? 100 : (pct ?? 30)}%` }} />
        </div>
      )}
      <Switch label={text.autoUpdates} hint={text.autoUpdatesHint} checked={auto} onChange={onAuto} />
      <Switch label={text.testBuilds} hint={text.testBuildsHint} checked={testBuilds} onChange={onTestBuilds} />
      {testBuilds && (
        <div className="test-builds">
          {tests === null ? (
            <p className="muted small">{text.testBuildsLoading}</p>
          ) : tests.length === 0 ? (
            <p className="muted small">{text.testBuildsNone}</p>
          ) : (
            tests.map((b, i) => {
              const when = Date.parse(b.built);
              return (
                <div key={b.pr} className="test-build">
                  <span>
                    <span className="test-build-title">
                      <button
                        type="button"
                        className="test-build-pr"
                        title={text.openPullRequest}
                        onClick={() => openPullRequest(b.pr)}
                      >
                        #{b.pr}
                      </button>
                      {b.title}
                    </span>
                    <span className="hint">
                      {i === 0 && <span className="test-build-newest">{text.newest}</span>}
                      {text.testBuilt(`${dayLabel(when)}, ${clockTime(when)}`)}
                    </span>
                  </span>
                  {b.version === current ? (
                    <span className="test-build-installed">{text.installed}</span>
                  ) : (
                    <button
                      className="soft-button small"
                      disabled={working || state.phase === "checking"}
                      onClick={() => updater.installTest(b.pr)}
                    >
                      {text.installTest}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
      <p className="card-note">{text.updateKeeps}</p>
    </Panel>
  );
}

function MiniButton({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <button type="button" className="mini-button" onClick={onClick}>
      {label}
    </button>
  );
}

function TestButton() {
  const [state, setState] = useState<"" | "sent" | "failed">("");
  const text = t().settings;
  return (
    <div className="row test-row">
      <span className="muted small">
        {state === "sent"
          ? text.testSent
          : state === "failed"
            ? text.testFailed
            : text.testIdle}
      </span>
      <button
        className="soft-button small"
        onClick={() =>
          testNotification()
            .then(() => setState("sent"))
            .catch(() => setState("failed"))
        }
      >
        {text.sendTest}
      </button>
    </div>
  );
}

function CalendarSection({ settings, google, categories, onGoogleChanged, set }: Props & { set(c: CalendarSettings): void }) {
  const cal = settings.calendar;
  const [clientId, setClientId] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (c: Partial<CalendarSettings>) => set({ ...cal, ...c });
  const writable = google.calendars.filter((c) => c.writable);
  const text = t().settings;

  if (!G.googleAvailable()) {
    return (
      <Panel>
        <p className="muted">{text.calendarDesktopOnly}</p>
      </Panel>
    );
  }

  if (!google.connected) {
    return (
      <>
        <Panel>
          <p className="muted small">
            {text.calendarSetup}
          </p>
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await G.connect(clientId, secret);
                setClientId("");
                setSecret("");
                onGoogleChanged();
              } catch (err) {
                setError(String(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              {text.clientId}
              <input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="…apps.googleusercontent.com"
              />
            </label>
            <label>
              {text.clientSecret}
              <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} />
            </label>
            <button className="squishy matcha" type="submit" disabled={busy || !clientId.trim() || !secret.trim()}>
              {busy ? text.waitingForGoogle : text.connect}
            </button>
            {error && (
              <p className="error small" role="alert">
                {error}
              </p>
            )}
          </form>
        </Panel>
      </>
    );
  }

  return (
    <Panel>
      <Switch
        label={text.syncSessions}
        hint={text.syncSessionsHint}
        checked={cal.syncSessions}
        onChange={(v) =>
          update({
            syncSessions: v,
            // Start from now, so turning this on doesn't copy old history.
            syncSince: v ? Date.now() : cal.syncSince,
            targetId: cal.targetId ?? writable.find((c) => c.primary)?.id ?? writable[0]?.id ?? null,
          })
        }
      />
      <label className="row">
        <span>{text.sessionsGoTo}</span>
        <select
          className="select-pill"
          value={cal.targetId ?? ""}
          onChange={(e) => update({ targetId: e.target.value || null })}
        >
          {cal.targetId === null && <option value="">{text.chooseCalendar}</option>}
          {writable.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <Switch label={text.includeBreaks} checked={cal.syncBreaks} onChange={(v) => update({ syncBreaks: v })} />
      {cal.syncSessions && (
        <>
          <div className="row">
            <span>
              {text.syncCategories}
              <span className="hint">{text.syncCategoriesHint}</span>
            </span>
          </div>
          <ul className="calendar-list">
            {categories.map((c) => (
              <li key={c.id}>
                <label className="row">
                  <span className="row-name">
                    <span className="dot" style={{ background: soft(c.color) }} />
                    {c.name}
                  </span>
                  <span className="toggle">
                    <input
                      type="checkbox"
                      aria-label={text.syncCategory(c.name)}
                      checked={!cal.skipCategories.includes(c.id)}
                      onChange={(e) =>
                        update({
                          skipCategories: e.target.checked
                            ? cal.skipCategories.filter((id) => id !== c.id)
                            : [...cal.skipCategories, c.id],
                        })
                      }
                    />
                    <span className="switch" aria-hidden="true" />
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
      <Switch
        label={text.showEvents}
        hint={text.showEventsHint}
        checked={cal.showEvents}
        onChange={(v) => update({ showEvents: v })}
      />
      {cal.showEvents && (
        <ul className="calendar-list">
          {google.calendars.map((c) => (
            <li key={c.id}>
              <label className="row">
                <span className="row-name">
                  <span className="dot" style={{ background: soft(c.color) }} />
                  {c.name}
                </span>
                <span className="toggle">
                  <input
                    type="checkbox"
                    aria-label={text.showCalendar(c.name)}
                    checked={!cal.hidden.includes(c.id)}
                    onChange={(e) =>
                      update({
                        hidden: e.target.checked ? cal.hidden.filter((h) => h !== c.id) : [...cal.hidden, c.id],
                      })
                    }
                  />
                  <span className="switch" aria-hidden="true" />
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="row">
        <span className="muted small">{text.connected}</span>
        <button
          className="quiet-link"
          onClick={async () => {
            await G.disconnect().catch(() => {});
            update({ syncSessions: false, showEvents: false });
            onGoogleChanged();
          }}
        >
          {text.disconnect}
        </button>
      </div>
    </Panel>
  );
}

/** `list` with the item at `from` moved to `to`. */
function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function Categories({ categories, store, onCategoriesChanged }: Props) {
  const [newName, setNewName] = useState("");
  const [picking, setPicking] = useState<number | null>(null);
  // While a row is dragged the list is shown in its new order before it's saved.
  const [order, setOrder] = useState<Category[]>(categories);
  const [dragging, setDragging] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (dragging === null) setOrder(categories);
  }, [categories, dragging]);

  const recolor = async (c: Category, color: string) => {
    await store.updateCategory({ ...c, color });
    onCategoriesChanged();
  };
  const saveOrder = async (list: Category[]) => {
    setOrder(list);
    await store.reorderCategories(list.map((c) => c.id));
    onCategoriesChanged();
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    void saveOrder(moveItem(order, from, to));
  };

  // Dragging uses pointer events so it works with a mouse, a pen and a finger.
  const startDrag = (e: PointerEvent<HTMLButtonElement>, id: number) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setPicking(null);
    setDragging(id);
  };
  const dragOver = (e: PointerEvent<HTMLButtonElement>) => {
    if (dragging === null || !listRef.current) return;
    const rows = [...listRef.current.children] as HTMLElement[];
    const from = order.findIndex((c) => c.id === dragging);
    let to = rows.findIndex((r) => {
      const box = r.getBoundingClientRect();
      return e.clientY < box.top + box.height / 2;
    });
    if (to === -1) to = rows.length - 1;
    else if (to > from) to -= 1;
    if (to !== from) setOrder(moveItem(order, from, to));
  };
  const endDrag = () => {
    if (dragging === null) return;
    setDragging(null);
    if (order.some((c, i) => c.id !== categories[i]?.id)) void saveOrder(order);
  };

  const text = t().settings;
  return (
    <Panel>
      <ul className="categories" ref={listRef}>
        {order.map((c, i) => (
          <li key={c.id} className={dragging === c.id ? "category-item dragging" : "category-item"}>
            <div className="category-row">
              <button
                className="drag-handle"
                aria-label={text.dragToReorder(c.name)}
                title={text.dragShort}
                disabled={order.length <= 1}
                onPointerDown={(e) => startDrag(e, c.id)}
                onPointerMove={dragOver}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    move(i, i - 1);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    move(i, i + 1);
                  }
                }}
              >
                <GripIcon />
              </button>
              <button
                className="swatch"
                style={{ background: soft(c.color) }}
                aria-label={text.changeColour(c.name)}
                aria-expanded={picking === c.id}
                onClick={() => setPicking(picking === c.id ? null : c.id)}
              />
              <input
                className="grow plain-input"
                aria-label={text.categoryName}
                defaultValue={c.name}
                onBlur={async (e) => {
                  const name = e.target.value.trim();
                  if (name && name !== c.name) {
                    await store.updateCategory({ ...c, name });
                    onCategoriesChanged();
                  }
                }}
              />
              <span className="order-buttons">
                <button
                  className="icon-only"
                  aria-label={text.moveUp(c.name)}
                  title={text.moveUpShort}
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                >
                  <ChevronUpIcon />
                </button>
                <button
                  className="icon-only"
                  aria-label={text.moveDown(c.name)}
                  title={text.moveDownShort}
                  disabled={i === order.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  <ChevronDownIcon />
                </button>
              </span>
              <button
                className="icon-only"
                aria-label={text.remove(c.name)}
                title={text.removeShort}
                disabled={categories.length <= 1}
                onClick={async () => {
                  await store.removeCategory(c.id);
                  onCategoriesChanged();
                }}
              >
                <XIcon />
              </button>
            </div>
            {picking === c.id && (
              <div className="swatch-row" role="group" aria-label={text.colours(c.name)}>
                {palette.map((col) => (
                  <button
                    key={col}
                    className="mini-swatch"
                    style={{ background: col }}
                    aria-label={text.useColour(col)}
                    aria-pressed={c.color.toLowerCase() === col}
                    onClick={() => recolor(c, col)}
                  />
                ))}
                <label className="custom-colour">
                  {text.custom}
                  <input
                    type="color"
                    aria-label={text.customColour(c.name)}
                    value={c.color}
                    onChange={(e) => recolor(c, e.target.value)}
                  />
                </label>
              </div>
            )}
          </li>
        ))}
      </ul>
      <form
        className="new-category"
        onSubmit={async (e) => {
          e.preventDefault();
          const name = newName.trim();
          if (!name) return;
          await store.addCategory(name, palette[categories.length % palette.length]);
          setNewName("");
          onCategoriesChanged();
        }}
      >
        <input
          className="grow"
          placeholder={text.newCategory}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button className="dashed-button" type="submit" disabled={!newName.trim()}>
          {text.add}
        </button>
      </form>
    </Panel>
  );
}
