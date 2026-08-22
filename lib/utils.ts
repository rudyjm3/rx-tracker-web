import type { Medication } from "@/lib/types/medications";

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
