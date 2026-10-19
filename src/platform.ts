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

/** A short two-note chime, generated so the app ships no sound files. */
export function chime(): void {
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    [660, 880].forEach((freq, i) => {
      const at = ctx.currentTime + i * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.65);
    });
  } catch {
    // No audio device; the notification still fires.
  }
}

/**
 * Notifies at a wall-clock time from the desktop shell, which keeps time even
 * while the window is hidden. Returns false in a plain browser, where the
 * window has to notify by itself.
 */
export function scheduleAlarm(atMs: number, title: string, body: string): boolean {
  if (!isTauri()) return false;
  invoke("schedule_alarm", { atMs: Math.round(atMs), title, body }).catch(() => {});
  return true;
}

export function cancelAlarm(): void {
  if (isTauri()) invoke("cancel_alarm").catch(() => {});
}

export async function testNotification(): Promise<void> {
  if (isTauri()) {
    const n = await import("@tauri-apps/plugin-notification");
    if (!(await n.isPermissionGranted())) await n.requestPermission();
    await invoke("test_notification", { body: t().notice.working });
    return;
  }
  if ("Notification" in window && Notification.permission !== "granted") await Notification.requestPermission();
  await notify("Stint", t().notice.working);
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
