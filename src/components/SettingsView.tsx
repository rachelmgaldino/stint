import { useState } from "react";
import type { Category, Settings, Store, Theme } from "../store";

type Props = {
  settings: Settings;
  categories: Category[];
  store: Store;
  onSettings(s: Settings): void;
  onCategoriesChanged(): void;
};

const palette = ["#e8594f", "#f2a541", "#52b788", "#4f8ee8", "#9b6ee8", "#e86fb0", "#6c757d"];

function Minutes({ label, value, onChange }: { label: string; value: number; onChange(v: number): void }) {
  return (
    <label className="row">
      <span>{label}</span>
      <span>
        <input
          type="number"
          min={1}
          max={240}
          value={value}
          onChange={(e) => {
            const v = Math.round(Number(e.target.value));
            if (v >= 1 && v <= 240) onChange(v);
          }}
        />{" "}
        min
      </span>
    </label>
  );
}

export function SettingsView({ settings, categories, store, onSettings, onCategoriesChanged }: Props) {
  const [newName, setNewName] = useState("");
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onSettings({ ...settings, [k]: v });

  return (
    <section className="settings">
      <h2>Timer</h2>
      <Minutes label="Focus length" value={settings.focusMinutes} onChange={(v) => set("focusMinutes", v)} />
      <Minutes label="Break length" value={settings.breakMinutes} onChange={(v) => set("breakMinutes", v)} />
      <label className="row">
        <span>Start a break after reflecting</span>
        <input type="checkbox" checked={settings.autoBreak} onChange={(e) => set("autoBreak", e.target.checked)} />
      </label>
      <label className="row">
        <span>Play a sound when time is up</span>
        <input type="checkbox" checked={settings.sound} onChange={(e) => set("sound", e.target.checked)} />
      </label>

      <h2>Appearance</h2>
      <label className="row">
        <span>Theme</span>
        <select value={settings.theme} onChange={(e) => set("theme", e.target.value as Theme)}>
          <option value="system">Match Windows</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>

      <h2>Categories</h2>
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

      <p className="muted small">Your sessions are saved on this computer only.</p>
    </section>
  );
}
