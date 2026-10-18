import { useState, type ReactNode } from "react";
import type { CalendarSettings, Category, Settings, Store, Theme } from "../store";
import * as G from "../google";
import { testNotification } from "../platform";
import { ratings } from "./Reflection";
import { RatingFace } from "./Pip";
import { palette, soft } from "../colors";
import { BellIcon, CalendarIcon, ClockIcon, SparkIcon, SunMoonIcon, TagIcon, XIcon } from "./icons";

type Props = {
  settings: Settings;
  categories: Category[];
  store: Store;
  google: { connected: boolean; calendars: G.GoogleCalendar[] };
  onGoogleChanged(): void;
  onSettings(s: Settings): void;
  onCategoriesChanged(): void;
};

const themes: { id: Theme; name: string }[] = [
  { id: "system", name: "Match Windows" },
  { id: "light", name: "Lavender day" },
  { id: "dark", name: "Plum night" },
];

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
          aria-label={`Less ${label.toLowerCase()}`}
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
          aria-label={`More ${label.toLowerCase()}`}
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

  return (
    <>
      <h1 className="page-title">Settings</h1>
      <div className="settings-columns">
        <div className="settings-column">
          <Card title="Timer" sub="How long sessions and breaks last" tone="apricot" icon={<ClockIcon />}>
            <Stepper
              label="Focus length"
              value={settings.focusMinutes}
              min={1}
              max={180}
              step={5}
              unit="min"
              onChange={(v) => set("focusMinutes", v)}
            />
            <Stepper
              label="Break length"
              value={settings.breakMinutes}
              min={1}
              max={60}
              unit="min"
              onChange={(v) => set("breakMinutes", v)}
            />
            <Stepper
              label="Daily goal"
              value={settings.dailyGoal}
              min={1}
              max={20}
              unit="sessions"
              onChange={(v) => set("dailyGoal", v)}
            />
            <p className="card-note">
              Sessions and breaks never end on their own. They keep counting until you end them.
            </p>
          </Card>

          <Card title="Notifications" sub="What happens when time is up" tone="lemon" icon={<BellIcon />}>
            <Switch
              label="Notify me when a session's time is up"
              checked={settings.notifyFocusEnd}
              onChange={(v) => set("notifyFocusEnd", v)}
            />
            <Switch
              label="Notify me when a break is over"
              checked={settings.notifyBreakEnd}
              onChange={(v) => set("notifyBreakEnd", v)}
            />
            <Switch label="Play a sound" checked={settings.sound} onChange={(v) => set("sound", v)} />
            <TestButton />
          </Card>

          <Card title="After a session" sub="Reflection and what comes next" tone="bubblegum" icon={<SparkIcon />}>
            <Switch
              label="Ask how it went"
              hint="When off, sessions are saved with the default mood."
              checked={settings.askReflection}
              onChange={(v) => set("askReflection", v)}
            />
            <div className="row">
              <span>Default mood</span>
              <span className="segmented small" role="group" aria-label="Default mood">
                <button aria-pressed={settings.defaultRating === 0} onClick={() => set("defaultRating", 0)}>
                  None
                </button>
                {ratings.map((r) => (
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
              label="Start a break automatically"
              checked={settings.autoBreak}
              onChange={(v) => set("autoBreak", v)}
            />
          </Card>
        </div>

        <div className="settings-column">
          <Card title="Theme" sub="Lavender by day, plum by night" tone="peri" icon={<SunMoonIcon />}>
            <div className="theme-picker">
              {themes.map((t) => (
                <button
                  key={t.id}
                  className={`theme-option ${t.id}`}
                  aria-pressed={settings.theme === t.id}
                  onClick={() => set("theme", t.id)}
                >
                  <span className="theme-swatch">
                    <span />
                  </span>
                  {t.name}
                </button>
              ))}
            </div>
          </Card>

          <Categories {...p} />

          <CalendarSection {...p} set={(c) => set("calendar", c)} />
        </div>
      </div>
      <p className="muted small page-foot">Your sessions are saved on this computer.</p>
    </>
  );
}

function TestButton() {
  const [state, setState] = useState<"" | "sent" | "failed">("");
  return (
    <div className="row test-row">
      <span className="muted small">
        {state === "sent"
          ? "Sent. If nothing appeared, check that notifications are on for Stint in Windows settings."
          : state === "failed"
            ? "Couldn't send a notification."
            : "Notifications show even while Stint is in the tray."}
      </span>
      <button
        className="soft-button small"
        onClick={() =>
          testNotification()
            .then(() => setState("sent"))
            .catch(() => setState("failed"))
        }
      >
        Send a test
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

  if (!G.googleAvailable()) {
    return (
      <Card title="Google Calendar" sub="Sync sessions and see your events" tone="matcha" icon={<CalendarIcon />}>
        <p className="muted">Google Calendar works in the Stint desktop app.</p>
      </Card>
    );
  }

  if (!google.connected) {
    return (
      <>
        <Card title="Google Calendar" sub="Sync sessions and see your events" tone="matcha" icon={<CalendarIcon />}>
          <p className="muted small">
            Stint talks to Google with your own Google Cloud app, so your calendar stays between you and Google. Follow
            “Google Calendar setup” in the Stint README once, then paste the two values here.
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
              Client ID
              <input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="…apps.googleusercontent.com"
              />
            </label>
            <label>
              Client secret
              <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} />
            </label>
            <button className="squishy matcha" type="submit" disabled={busy || !clientId.trim() || !secret.trim()}>
              {busy ? "Waiting for Google in your browser…" : "Connect"}
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
    <Card title="Google Calendar" sub="Sync sessions and see your events" tone="matcha" icon={<CalendarIcon />}>
      <Switch
        label="Show sessions on Google Calendar"
        hint="Each session you finish is added as an event."
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
        <span>Sessions go to</span>
        <select
          className="select-pill"
          value={cal.targetId ?? ""}
          onChange={(e) => update({ targetId: e.target.value || null })}
        >
          {cal.targetId === null && <option value="">Choose a calendar</option>}
          {writable.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <Switch label="Include breaks" checked={cal.syncBreaks} onChange={(v) => update({ syncBreaks: v })} />
      <Switch
        label="Show my calendar in Stint"
        hint="Events appear above your sessions on the Today ribbon."
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
                    aria-label={`Show ${c.name}`}
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
        <span className="muted small">Connected to Google Calendar.</span>
        <button
          className="quiet-link"
          onClick={async () => {
            await G.disconnect().catch(() => {});
            update({ syncSessions: false, showEvents: false });
            onGoogleChanged();
          }}
        >
          Disconnect
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
  return (
    <Card title="Categories" sub="Tags for what you work on" tone="sky" icon={<TagIcon />}>
      <ul className="categories">
        {categories.map((c) => (
          <li key={c.id} className="category-item">
            <div className="category-row">
              <button
                className="swatch"
                style={{ background: soft(c.color) }}
                aria-label={`Change ${c.name} colour`}
                aria-expanded={picking === c.id}
                onClick={() => setPicking(picking === c.id ? null : c.id)}
              />
              <input
                className="grow plain-input"
                aria-label="Category name"
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
                aria-label={`Remove ${c.name}`}
                title="Remove"
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
              <div className="swatch-row" role="group" aria-label={`Colours for ${c.name}`}>
                {palette.map((col) => (
                  <button
                    key={col}
                    className="mini-swatch"
                    style={{ background: col }}
                    aria-label={`Use ${col}`}
                    aria-pressed={c.color.toLowerCase() === col}
                    onClick={() => recolor(c, col)}
                  />
                ))}
                <label className="custom-colour">
                  Custom
                  <input
                    type="color"
                    aria-label={`Custom colour for ${c.name}`}
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
          placeholder="New category"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button className="dashed-button" type="submit" disabled={!newName.trim()}>
          + Add
        </button>
      </form>
    </Card>
  );
}
