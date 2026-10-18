import { invoke, isTauri } from "@tauri-apps/api/core";

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
