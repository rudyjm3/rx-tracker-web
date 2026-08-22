import type { Medication } from "@/lib/types/medications";

// Local calendar date (YYYY-MM-DD), not UTC — toISOString() would shift
// the date for any user not on UTC, especially for several hours around
// local midnight (e.g. a UTC-7 user sees tomorrow's date after 5pm local).
export function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function to12h(time: string): string {
  const [hourStr, minuteStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = (minuteStr ?? "00").padStart(2, "0");
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${period}`;
}

export function timeToMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function minutesToTime(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(Math.round(minutes % 60)).padStart(2, "0");
  return `${h}:${m}`;
}

interface LateCheckLog {
  status: string;
  taken_at: string | null;
  scheduled_for_date: string;
  scheduled_time: string;
}

export function isLate(log: LateCheckLog, graceMinutes: number): boolean {
  if (log.status !== "taken" || !log.taken_at) return false;
  const scheduled = new Date(`${log.scheduled_for_date}T${log.scheduled_time}`);
  const threshold = new Date(scheduled.getTime() + graceMinutes * 60000);
  return new Date(log.taken_at) > threshold;
}

// How many minutes past the grace threshold a taken dose was logged, or
// null if it wasn't late (or isn't a taken dose). Used where the actual
// "Xmins late" label is shown, not just a late/on-time boolean.
export function minutesLate(log: LateCheckLog, graceMinutes: number): number | null {
  if (log.status !== "taken" || !log.taken_at) return null;
  const scheduled = new Date(`${log.scheduled_for_date}T${log.scheduled_time}`);
  const threshold = new Date(scheduled.getTime() + graceMinutes * 60000);
  const diffMs = new Date(log.taken_at).getTime() - threshold.getTime();
  return diffMs > 0 ? Math.ceil(diffMs / 60000) : null;
}

export function formatLate(minutes: number): string {
  if (minutes < 60) return `${minutes}mins late`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}hr ${mins}mins late` : `${hrs}hr late`;
}

export function daysUntilRunout(medication: Medication): number | null {
  const qty = medication.current_quantity ?? 0;
  if (qty <= 0) return 0;
  const dosesPerDay =
    medication.schedule_mode === "fixed_times"
      ? (medication.medication_schedule_times?.length ?? 0)
      : medication.interval_hours
        ? Math.max(1, Math.round(24 / medication.interval_hours))
        : 0;
  if (dosesPerDay <= 0) return null;
  return Math.floor(qty / dosesPerDay);
}

// Whole years between a birth date and today — falls back to a birth
// year alone (family_profiles carries both, for members whose exact date
// isn't known) when there's no birth date. Port of the reference PHP
// app's calculate_age().
export function calculateAge(
  birthDate: string | null,
  birthYear?: number | null,
): number | null {
  if (birthDate) {
    const birth = new Date(`${birthDate}T00:00:00`);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const beforeBirthdayThisYear =
      now.getMonth() < birth.getMonth() ||
      (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
    if (beforeBirthdayThisYear) age--;
    return age;
  }
  if (birthYear) return new Date().getFullYear() - birthYear;
  return null;
}

export function heightToInches(value: number, unit: string): number {
  return unit === "cm" ? value / 2.54 : value;
}

export function formatFeetInches(totalInches: number): string {
  const clamped = Math.max(0, totalInches);
  let feet = Math.floor(clamped / 12);
  let inches = Math.round(clamped - feet * 12);
  if (inches === 12) {
    feet++;
    inches = 0;
  }
  return `${feet}' ${inches}"`;
}

// First name + last initial ("Sarah J."), or whichever name part is
// present, or the email's local part as a last resort — matches the
// reference app's fallback_display_name(), extended with an email
// fallback since this app always has one (unlike a family member, who
// might have neither name part set).
export function fallbackDisplayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  email?: string | null,
): string {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  if (first && last) return `${first} ${last.charAt(0).toUpperCase()}.`;
  if (first) return first;
  if (last) return last;
  return email ? email.split("@")[0] : "";
}
