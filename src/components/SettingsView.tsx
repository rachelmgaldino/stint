import { useState, type ReactNode } from "react";
import type { CalendarSettings, Category, Settings, Store, Theme } from "../store";
import * as G from "../google";
import { testNotification } from "../platform";
import { ratings } from "./Reflection";
import { RatingFace } from "./Pip";
import { palette, soft } from "../colors";
import { BellIcon, CalendarIcon, ClockIcon, GlobeIcon, SparkIcon, SunMoonIcon, TagIcon, XIcon } from "./icons";
import { languages, t } from "../i18n";
import type { Look } from "../look";
import { Pip } from "./Pip";

type Props = {
  settings: Settings;
  categories: Category[];
  store: Store;
  google: { connected: boolean; calendars: G.GoogleCalendar[] };
  onGoogleChanged(): void;
  onSettings(s: Settings): void;
  onCategoriesChanged(): void;
};

const themes: Theme[] = ["system", "light", "dark"];
const looks: Look[] = ["lavender", "mochi"];

function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange(v: number): void;
}) {
  const go = (d: number) => onChange(Math.min(max, Math.max(min, value + d)));
  return (
    <div className="row">
      <span>{label}</span>
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
          {value} {unit}
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
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange(v: boolean): void;
}) {
  return (
    <label className="row">
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

type Tone = "apricot" | "lemon" | "bubblegum" | "peri" | "sky" | "matcha";

function Card({
  title,
  sub,
  tone,
  icon,
  children,
}: {
  title: string;
  sub: string;
  tone: Tone;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card settings-card" aria-label={title}>
      <div className="settings-card-head">
        <span className={`settings-icon ${tone}`}>{icon}</span>
        <div>
          <h2>{title}</h2>
          <p className="settings-sub">{sub}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function SettingsView(p: Props) {
  const { settings } = p;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => p.onSettings({ ...settings, [k]: v });
  const text = t().settings;

  return (
    <>
      <h1 className="page-title">{text.title}</h1>
      <div className="settings-columns">
        <div className="settings-column">
          <Card title={text.timer} sub={text.timerSub} tone="apricot" icon={<ClockIcon />}>
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
              label={text.dailyGoal}
              value={settings.dailyGoal}
              min={1}
              max={20}
              unit={text.sessions}
              onChange={(v) => set("dailyGoal", v)}
            />
            <p className="card-note">
              {text.neverEnd}
            </p>
          </Card>

          <Card title={text.notifications} sub={text.notificationsSub} tone="lemon" icon={<BellIcon />}>
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
            <TestButton />
          </Card>

          <Card title={text.after} sub={text.afterSub} tone="bubblegum" icon={<SparkIcon />}>
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
          </Card>
        </div>

        <div className="settings-column">
          <Card
            title={text.theme}
            sub={settings.look === "mochi" ? text.themeSubMochi : text.themeSub}
            tone="peri"
            icon={<SunMoonIcon />}
          >
            <div className="look-picker" role="group" aria-label={text.look}>
              {looks.map((id) => (
                <button key={id} className="look-option" aria-pressed={settings.look === id} onClick={() => set("look", id)}>
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
                  {(settings.look === "mochi" ? text.themesMochi : text.themes)[id]}
                </button>
              ))}
            </div>
          </Card>

          <Card title={text.language} sub={text.languageSub} tone="lemon" icon={<GlobeIcon />}>
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
          </Card>

          <Categories {...p} />

          <CalendarSection {...p} set={(c) => set("calendar", c)} />
        </div>
      </div>
      <p className="muted small page-foot">{text.savedLocally}</p>
    </>
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

function CalendarSection({ settings, google, onGoogleChanged, set }: Props & { set(c: CalendarSettings): void }) {
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
      <Card title={text.calendar} sub={text.calendarSub} tone="matcha" icon={<CalendarIcon />}>
        <p className="muted">{text.calendarDesktopOnly}</p>
      </Card>
    );
  }

  if (!google.connected) {
    return (
      <>
        <Card title={text.calendar} sub={text.calendarSub} tone="matcha" icon={<CalendarIcon />}>
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
        </Card>
      </>
    );
  }

  return (
    <Card title={text.calendar} sub={text.calendarSub} tone="matcha" icon={<CalendarIcon />}>
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
    </Card>
  );
}

function Categories({ categories, store, onCategoriesChanged }: Props) {
  const [newName, setNewName] = useState("");
  const [picking, setPicking] = useState<number | null>(null);
  const recolor = async (c: Category, color: string) => {
    await store.updateCategory({ ...c, color });
    onCategoriesChanged();
  };
  const text = t().settings;
  return (
    <Card title={text.categories} sub={text.categoriesSub} tone="sky" icon={<TagIcon />}>
      <ul className="categories">
        {categories.map((c) => (
          <li key={c.id} className="category-item">
            <div className="category-row">
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
    </Card>
  );
}
