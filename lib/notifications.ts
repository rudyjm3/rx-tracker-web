// In-app "dose due" alert — an audible tone plus device vibration while
// the dashboard tab is open. No service worker, no push subscription:
// this is purely a client-side alert triggered by DashboardClient's
// existing polling, matching the reference PHP app's "Alarm sound"/
// "Vibration" toggles, which are themselves client-only (never read from
// a saved server-side setting).

const SOUND_KEY = "rxtracker-alarm-sound";
const VIBRATION_KEY = "rxtracker-vibration";

function readToggle(key: string): boolean {
  if (typeof window === "undefined") return true;
  const raw = localStorage.getItem(key);
  return raw === null ? true : raw === "1";
}

function writeToggle(key: string, enabled: boolean): void {
  localStorage.setItem(key, enabled ? "1" : "0");
}

export function isAlarmSoundEnabled(): boolean {
  return readToggle(SOUND_KEY);
}

export function setAlarmSoundEnabled(enabled: boolean): void {
  writeToggle(SOUND_KEY, enabled);
}

export function isVibrationEnabled(): boolean {
  return readToggle(VIBRATION_KEY);
}

export function setVibrationEnabled(enabled: boolean): void {
  writeToggle(VIBRATION_KEY, enabled);
}

let audioCtx: AudioContext | null = null;

// A short two-tone beep, synthesized via Web Audio rather than shipping
// an audio asset — no licensing/sourcing concerns and no new binary file
// in the repo.
function tone(): void {
  try {
    const Ctx = window.AudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    const ctx = audioCtx;
    const now = ctx.currentTime;
    [0, 0.35].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, now + offset + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.3);
    });
  } catch {
    // Best-effort — a browser without Web Audio (or one that blocks
    // autoplay before any user gesture) just means no sound this time.
  }
}

function vibrate(): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate([200, 100, 200]);
  }
}

export function playAlarmSound(): void {
  if (isAlarmSoundEnabled()) tone();
}

export function triggerVibration(): void {
  if (isVibrationEnabled()) vibrate();
}

// Bypasses both toggles — lets the Settings page's "Test alarm" button
// preview sound/vibration even while deciding whether to turn them on.
export function previewAlarm(): void {
  tone();
  vibrate();
}
