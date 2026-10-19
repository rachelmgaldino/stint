import { invoke, isTauri } from "@tauri-apps/api/core";
import { t } from "./i18n";

export async function notify(title: string, body: string): Promise<void> {
  try {
    if (isTauri()) {
      const n = await import("@tauri-apps/plugin-notification");
      let granted = await n.isPermissionGranted();
      if (!granted) granted = (await n.requestPermission()) === "granted";
      if (granted) n.sendNotification({ title, body });
      return;
    }
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch (e) {
    console.warn("notification failed", e);
  }
}

/** Shows the remaining time when hovering the tray icon. */
export function setTrayTooltip(text: string): void {
  if (!isTauri()) return;
  invoke("set_tray_tooltip", { text }).catch(() => {});
}

/** Names the tray menu's items in the chosen language. */
export function setTrayMenu(open: string, quit: string): void {
  if (!isTauri()) return;
  invoke("set_tray_menu", { open, quit }).catch(() => {});
}

let audio: AudioContext | null = null;

export type Sound = "chime" | "soon" | "presence";

// Notes (Hz), spacing (s), loudness and decay for each sound. The chime is a
// rising two-note "ding-ding"; "soon" is one light ping; presence is a single
// low, quiet note meant to nudge rather than alert.
const sounds: Record<Sound, { notes: number[]; gap: number; peak: number; decay: number }> = {
  chime: { notes: [660, 880], gap: 0.22, peak: 0.25, decay: 0.6 },
  soon: { notes: [988], gap: 0, peak: 0.18, decay: 0.45 },
  presence: { notes: [523], gap: 0, peak: 0.12, decay: 1.2 },
};

/** Plays a short generated sound, so the app ships no sound files. */
export function playSound(sound: Sound): void {
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    if (ctx.state === "suspended") void ctx.resume();
    const { notes, gap, peak, decay } = sounds[sound];
    notes.forEach((freq, i) => {
      const at = ctx.currentTime + i * gap;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(peak, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + decay + 0.05);
    });
  } catch {
    // No audio device; the notification still fires.
  }
}

export type PlannedAlarm = {
  key: string;
  at: number;
  notice?: { title: string; body: string };
  sound?: Sound;
};

const scheduled = new Map<string, number>();
const browserTimers = new Map<string, ReturnType<typeof setTimeout>>();
let fired: (key: string) => void = () => {};
let listening = false;

/**
 * Keeps the pending alarms in step with `alarms`: new or moved ones are
 * scheduled, ones no longer listed are cancelled. In the desktop app the shell
 * keeps time, so alarms fire on time even while the window is hidden; in a
 * browser the page does it itself. `onFire` gets the key of each alarm as it
 * goes off, for sounds and follow-ups.
 */
export function syncAlarms(alarms: PlannedAlarm[], onFire: (alarm: string) => void): void {
  fired = onFire;
  const tauri = isTauri();
  if (tauri && !listening) {
    listening = true;
    import("@tauri-apps/api/event")
      .then((e) => e.listen<string>("alarm", (ev) => {
        scheduled.delete(ev.payload);
        fired(ev.payload);
      }))
      .catch(() => {});
  }
  const wanted = new Map(alarms.map((a) => [a.key, a]));
  for (const key of [...scheduled.keys()]) {
    if (wanted.has(key)) continue;
    scheduled.delete(key);
    if (tauri) invoke("cancel_alarm", { key }).catch(() => {});
    else clearTimeout(browserTimers.get(key));
  }
  for (const a of alarms) {
    const at = Math.round(a.at);
    if (scheduled.get(a.key) === at) continue;
    scheduled.set(a.key, at);
    if (tauri) {
      invoke("schedule_alarm", { key: a.key, atMs: at, title: a.notice?.title, body: a.notice?.body }).catch(() => {});
      continue;
    }
    clearTimeout(browserTimers.get(a.key));
    browserTimers.set(
      a.key,
      setTimeout(() => {
        scheduled.delete(a.key);
        if (a.notice) notify(a.notice.title, a.notice.body);
        fired(a.key);
      }, Math.max(0, at - Date.now())),
    );
  }
}

/** Shows a notification right away, the way an alarm would. */
export async function testNotification(title = "Stint", body = t().notice.working): Promise<void> {
  if (isTauri()) {
    const n = await import("@tauri-apps/plugin-notification");
    if (!(await n.isPermissionGranted())) await n.requestPermission();
    await invoke("test_notification", { title, body });
    return;
  }
  if ("Notification" in window && Notification.permission !== "granted") await Notification.requestPermission();
  await notify(title, body);
}

/**
 * Saves a report: through a save window in the desktop app, as a download in a
 * browser. Resolves false when the save window is cancelled.
 */
export async function saveReport(fileName: string, contents: string): Promise<boolean> {
  if (isTauri()) return invoke<boolean>("save_report", { fileName, contents });
  const url = URL.createObjectURL(new Blob([contents], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Older webviews without the clipboard API.
    const area = document.createElement("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}
