import { useState, type ReactNode } from "react";
import type { CalendarSettings, Category, Settings, Store, Theme } from "../store";
import * as G from "../google";
import { testNotification } from "../platform";
import { ratings } from "./Reflection";

type Props = {
  settings: Settings;
  categories: Category[];
  store: Store;
  google: { connected: boolean; calendars: G.GoogleCalendar[] };
  onGoogleChanged(): void;
  onSettings(s: Settings): void;
  onCategoriesChanged(): void;
};

type Section = "general" | "notifications" | "calendar" | "categories" | "display";

const sections: { id: Section; label: string }[] = [
  { id: "general", label: "General" },
  { id: "notifications", label: "Notifications" },
  { id: "calendar", label: "Calendar" },
  { id: "categories", label: "Categories" },
  { id: "display", label: "Display" },
];

const palette = ["#e8594f", "#f2a541", "#52b788", "#4f8ee8", "#9b6ee8", "#e86fb0", "#6c757d"];

function Number_({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange(v: number): void;
}) {
  return (
    <label className="row">
      <span>{label}</span>
      <span>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const v = Math.round(Number(e.target.value));
            if (v >= min && v <= max) onChange(v);
          }}
        />{" "}
        {unit}
      </span>
    </label>
  );
}

function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <label className="row">
      <span>
        {label}
        {hint && <span className="hint">{hint}</span>}
      </span>
      <span className="toggle bare">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="switch" aria-hidden="true" />
      </span>
    </label>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div className="card settings-card">{children}</div>;
}

export function SettingsView(p: Props) {
  const { settings } = p;
  const [section, setSection] = useState<Section>("general");
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => p.onSettings({ ...settings, [k]: v });

  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Settings sections">
        {sections.map((s) => (
          <button
            key={s.id}
            className={section === s.id ? "active" : ""}
            aria-current={section === s.id ? "page" : undefined}
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <section className="settings" aria-label={sections.find((s) => s.id === section)?.label}>
        {section === "general" && (
          <>
            <Card>
              <Number_ label="Focus length" value={settings.focusMinutes} min={1} max={240} unit="min" onChange={(v) => set("focusMinutes", v)} />
              <Number_ label="Break length" value={settings.breakMinutes} min={1} max={240} unit="min" onChange={(v) => set("breakMinutes", v)} />
              <Number_ label="Daily goal" value={settings.dailyGoal} min={1} max={20} unit="sessions" onChange={(v) => set("dailyGoal", v)} />
            </Card>
            <Card>
              <Switch label="Start break automatically" checked={settings.autoBreak} onChange={(v) => set("autoBreak", v)} />
            </Card>
            <Card>
              <Switch
                label="Ask for a reflection when a session ends"
                hint="When off, sessions are saved with the default mood."
                checked={settings.askReflection}
                onChange={(v) => set("askReflection", v)}
              />
              <label className="row">
                <span>Default mood</span>
                <select value={settings.defaultRating} onChange={(e) => set("defaultRating", Number(e.target.value))}>
                  <option value={0}>Not rated</option>
                  {[...ratings].reverse().map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
            </Card>
            <p className="muted small">
              When the time is up, a session keeps counting into overtime until you finish it. Your sessions are saved on
              this computer.
            </p>
          </>
        )}

        {section === "notifications" && (
          <>
            <Card>
              <Switch label="When a session's time is up" checked={settings.notifyFocusEnd} onChange={(v) => set("notifyFocusEnd", v)} />
              <Switch label="When a break is over" checked={settings.notifyBreakEnd} onChange={(v) => set("notifyBreakEnd", v)} />
              <Switch label="Play a sound" checked={settings.sound} onChange={(v) => set("sound", v)} />
            </Card>
            <TestButton />
          </>
        )}

        {section === "calendar" && <CalendarSection {...p} set={(c) => set("calendar", c)} />}

        {section === "categories" && <Categories {...p} />}

        {section === "display" && (
          <Card>
            <label className="row">
              <span>Theme</span>
              <select value={settings.theme} onChange={(e) => set("theme", e.target.value as Theme)}>
                <option value="system">Match Windows</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
          </Card>
        )}
      </section>
    </div>
  );
}

function TestButton() {
  const [state, setState] = useState<"" | "sent" | "failed">("");
  return (
    <div className="row">
      <span className="muted small">
        {state === "sent"
          ? "Sent. If nothing appeared, check that notifications are on for Stint in Windows settings."
          : state === "failed"
            ? "Couldn't send a notification."
            : "Notifications show even while Stint is in the tray."}
      </span>
      <button
        className="secondary"
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

function CalendarSection({
  settings,
  google,
  onGoogleChanged,
  set,
}: Props & { set(c: CalendarSettings): void }) {
  const cal = settings.calendar;
  const [clientId, setClientId] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (c: Partial<CalendarSettings>) => set({ ...cal, ...c });
  const writable = google.calendars.filter((c) => c.writable);

  if (!G.googleAvailable()) {
    return (
      <Card>
        <p className="muted">Google Calendar works in the Stint desktop app.</p>
      </Card>
    );
  }

  if (!google.connected) {
    return (
      <>
        <Card>
          <h3 className="card-heading">Connect Google Calendar</h3>
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
              <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="…apps.googleusercontent.com" />
            </label>
            <label>
              Client secret
              <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} />
            </label>
            <button className="primary" type="submit" disabled={busy || !clientId.trim() || !secret.trim()}>
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
    <>
      <Card>
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
          <span>Calendar</span>
          <select value={cal.targetId ?? ""} onChange={(e) => update({ targetId: e.target.value || null })}>
            {cal.targetId === null && <option value="">Choose a calendar</option>}
            {writable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <Switch label="Include breaks" checked={cal.syncBreaks} onChange={(v) => update({ syncBreaks: v })} />
      </Card>

      <Card>
        <Switch
          label="Show my calendar in Stint"
          hint="Events appear beside your sessions on the day timeline."
          checked={cal.showEvents}
          onChange={(v) => update({ showEvents: v })}
        />
        {cal.showEvents && (
          <ul className="calendar-list">
            {google.calendars.map((c) => (
              <li key={c.id}>
                <label className="row">
                  <span className="row-name">
                    <span className="dot" style={{ background: c.color }} />
                    {c.name}
                  </span>
                  <span className="toggle bare">
                    <input
                      type="checkbox"
                      aria-label={`Show ${c.name}`}
                      checked={!cal.hidden.includes(c.id)}
                      onChange={(e) =>
                        update({ hidden: e.target.checked ? cal.hidden.filter((h) => h !== c.id) : [...cal.hidden, c.id] })
                      }
                    />
                    <span className="switch" aria-hidden="true" />
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="row">
        <span className="muted small">Connected to Google Calendar.</span>
        <button
          className="secondary"
          onClick={async () => {
            await G.disconnect().catch(() => {});
            update({ syncSessions: false, showEvents: false });
            onGoogleChanged();
          }}
        >
          Disconnect
        </button>
      </div>
    </>
  );
}

function Categories({ categories, store, onCategoriesChanged }: Props) {
  const [newName, setNewName] = useState("");
  return (
    <Card>
      <ul className="categories">
        {categories.map((c) => (
          <li key={c.id} className="row">
            <input
              type="color"
              aria-label={`${c.name} colour`}
              value={c.color}
              onChange={async (e) => {
                await store.updateCategory({ ...c, color: e.target.value });
                onCategoriesChanged();
              }}
            />
            <input
              className="grow"
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
              className="link"
              disabled={categories.length <= 1}
              onClick={async () => {
                await store.removeCategory(c.id);
                onCategoriesChanged();
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form
        className="row"
        onSubmit={async (e) => {
          e.preventDefault();
          const name = newName.trim();
          if (!name) return;
          await store.addCategory(name, palette[categories.length % palette.length]);
          setNewName("");
          onCategoriesChanged();
        }}
      >
        <input className="grow" placeholder="New category" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="secondary" type="submit">
          Add
        </button>
      </form>
    </Card>
  );
}
