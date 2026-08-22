import { finalizeMissedDoses, type CalendarLogRow } from "@/lib/dose-logs";
import { generateDaySlots } from "@/lib/schedule";
import { formatLate, localDateString, minutesLate, to12h } from "@/lib/utils";
import type {
  DoseLogStatus,
  Medication,
  MedicationGroup,
  MedicationGroupMember,
  MedicationStatusEvent,
} from "@/lib/types/medications";

/**
 * Reconstructs whether a medication was active as of 23:59:59 on `date`,
 * by replaying its status events up to that point rather than trusting the
 * medication's current `active` flag (which only reflects "right now").
 * No prior event at/before that date means the medication's default
 * (active-since-creation) state. Port of the reference PHP app's
 * wasMedicationActiveOnDate.
 */
export function wasActiveOnDate(
  medicationId: string,
  date: string,
  statusEvents: MedicationStatusEvent[],
): boolean {
  const dateEnd = `${date}T23:59:59`;
  const eventsForMed = statusEvents
    .filter((e) => e.medication_id === medicationId && e.event_at <= dateEnd)
    .sort((a, b) => b.event_at.localeCompare(a.event_at));
  const lastEvent = eventsForMed[0];
  if (!lastEvent) return true;
  return lastEvent.event !== "discontinued";
}

/**
 * Currently-inactive medications that were nonetheless active as of `date`
 * — so calendar backfill can finalize missed doses for medications
 * discontinued after that date instead of silently skipping them (the
 * caller's "active medications" list only reflects "right now"). Requires
 * an actual status event to exist before trusting the reconstruction: a
 * medication with zero events has genuinely unknown history and is
 * skipped rather than assumed active for every past date.
 */
export function historicallyActiveMedications(
  date: string,
  inactiveMedications: Medication[],
  statusEvents: MedicationStatusEvent[],
): Medication[] {
  return inactiveMedications.filter(
    (med) =>
      statusEvents.some((e) => e.medication_id === med.id) &&
      wasActiveOnDate(med.id, date, statusEvents),
  );
}

/**
 * Whether a medication's *current* schedule can be trusted to reflect
 * what applied on a past `date`. Editing a medication deletes and
 * re-inserts all of its medication_schedule_times, so every row's
 * created_at moves forward together — if the earliest one is after
 * `date`, the whole current schedule postdates that day and backfilling
 * against it would synthesize a phantom missed dose at the *new* time
 * alongside whatever was really logged at the old time. Interval-mode
 * medications have no per-time timestamp to check against (matching the
 * reference PHP app's own scope, which only checks fixed-time schedules)
 * — fails open there, same as when there's no schedule data at all.
 */
function scheduleValidForDate(med: Medication, date: string): boolean {
  if (med.schedule_mode !== "fixed_times") return true;
  const times = med.medication_schedule_times ?? [];
  if (times.length === 0) return true;
  const dateEnd = `${date}T23:59:59`;
  return times.every((t) => t.created_at <= dateEnd);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return localDateString(d);
}

/**
 * Re-runs missed-dose finalization for every date in [monthStart,
 * min(monthEnd, todayDate)] (future dates are skipped — there's nothing
 * to finalize yet; today is included so doses already past their grace
 * cutoff show up even if the user opens /calendar without ever visiting
 * the dashboard), so calendar days aren't permanently blank just because
 * nobody had the app open that day. Idempotent per date via
 * finalizeMissedDoses' ignoreDuplicates guard, so safe to re-run on every
 * month load. Returns whether anything was actually finalized, so the
 * caller can invalidate its queries only when there's something new to
 * fetch (same pattern as the dashboard's own finalize effect).
 *
 * `statusEvents` must cover both active and inactive medications: a
 * medication can be discontinued and later resumed, in which case it's
 * active *now* but wasn't active for every date in between, so
 * activeMedications can't be included unconditionally — each one is
 * checked against its own history the same way inactive medications are.
 */
export async function backfillMonth(
  monthStart: string,
  monthEnd: string,
  todayDate: string,
  activeMedications: Medication[],
  inactiveMedications: Medication[],
  groups: MedicationGroup[],
  groupMembers: Pick<MedicationGroupMember, "group_id" | "medication_id" | "quantity_per_dose">[],
  statusEvents: MedicationStatusEvent[],
  graceMinutes: number,
): Promise<boolean> {
  const lastBackfillDate = monthEnd < todayDate ? monthEnd : todayDate;
  if (lastBackfillDate < monthStart) return false;

  let didFinalize = false;
  for (
    let date = monthStart;
    date <= lastBackfillDate;
    date = addDays(date, 1)
  ) {
    const medsForDate = [
      ...activeMedications.filter((med) => wasActiveOnDate(med.id, date, statusEvents)),
      ...historicallyActiveMedications(date, inactiveMedications, statusEvents),
    ].filter((med) => scheduleValidForDate(med, date));
    const slots = generateDaySlots(date, medsForDate, groups, groupMembers, [], []);
    const finalized = await finalizeMissedDoses(date, slots, graceMinutes);
    didFinalize ||= finalized;
  }
  return didFinalize;
}

export type CalendarDayColor = "future" | "missed" | "skipped" | "taken" | "empty";

/**
 * Day-cell color priority, matching the reference app: future days are
 * neutral regardless of data; otherwise missed beats skipped-only beats
 * taken beats no data at all.
 */
export function calendarDayColor(
  isFuture: boolean,
  marker: { taken: number; skipped: number; missed: number } | undefined,
): CalendarDayColor {
  if (isFuture) return "future";
  if (!marker) return "empty";
  if (marker.missed > 0) return "missed";
  if (marker.skipped > 0 && marker.taken === 0) return "skipped";
  if (marker.taken > 0) return "taken";
  return "empty";
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface MonthBounds {
  monthStart: string; // YYYY-MM-01
  monthEnd: string; // YYYY-MM-DD, the month's last day
  daysInMonth: number;
  firstDow: number; // 0 (Sun) .. 6 (Sat), weekday of the 1st
  prevMonth: string; // YYYY-MM
  nextMonth: string; // YYYY-MM
  label: string; // e.g. "August 2026"
}

/**
 * Local-time month arithmetic for the calendar grid — built from
 * Date's local-time constructor (never toISOString()) so it can't drift
 * a day near month boundaries the way UTC-based math would.
 */
export function monthBounds(month: string): MonthBounds {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstDow = new Date(year, monthIndex, 1).getDay();
  const prevDate = new Date(year, monthIndex - 1, 1);
  const nextDate = new Date(year, monthIndex + 1, 1);

  return {
    monthStart: `${month}-01`,
    monthEnd: `${month}-${String(daysInMonth).padStart(2, "0")}`,
    daysInMonth,
    firstDow,
    prevMonth: `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`,
    nextMonth: `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`,
    label: `${MONTH_NAMES[monthIndex]} ${year}`,
  };
}

export interface CalendarDaySlot {
  logId: string;
  medicationId: string;
  time: string; // "HH:MM"
  displayTime: string; // 12h
  status: DoseLogStatus;
  isLate: boolean;
  lateLabel: string | null;
  takenAt: string | null;
  painLevel: number | null;
  moodLevel: number | null;
  note: string;
}

export interface CalendarDayMedicationSummary {
  medicationId: string;
  name: string;
  dose: string;
  total: number;
  taken: number;
  late: number;
  skipped: number;
  missed: number;
  slots: CalendarDaySlot[];
}

export interface CalendarDayDetail {
  date: string;
  dayName: string; // e.g. "Friday"
  displayDate: string; // e.g. "August 22, 2026"
  medications: CalendarDayMedicationSummary[];
}

/**
 * Groups a month's raw dose_logs into per-day, per-medication summaries
 * for the day-detail view — port of the reference PHP app's
 * $calendarDayData building loop in routes/calendar.php.
 */
export function buildDayDetails(
  logs: CalendarLogRow[],
  graceMinutes: number,
): Record<string, CalendarDayDetail> {
  const result: Record<string, CalendarDayDetail> = {};

  for (const log of logs) {
    const date = log.scheduled_for_date;
    let day = result[date];
    if (!day) {
      const d = new Date(`${date}T00:00:00`);
      day = {
        date,
        dayName: d.toLocaleDateString(undefined, { weekday: "long" }),
        displayDate: d.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        medications: [],
      };
      result[date] = day;
    }

    let med = day.medications.find((m) => m.medicationId === log.medication_id);
    if (!med) {
      med = {
        medicationId: log.medication_id,
        name: log.medications.name,
        dose: log.medications.dose,
        total: 0,
        taken: 0,
        late: 0,
        skipped: 0,
        missed: 0,
        slots: [],
      };
      day.medications.push(med);
    }

    const lateMin = minutesLate(log, graceMinutes);
    med.total++;
    if (log.status === "taken") {
      med.taken++;
      if (lateMin !== null) med.late++;
    } else if (log.status === "skipped") {
      med.skipped++;
    } else if (log.status === "missed") {
      med.missed++;
    }

    const time = log.scheduled_time.slice(0, 5);
    med.slots.push({
      logId: log.id,
      medicationId: log.medication_id,
      time,
      displayTime: to12h(time),
      status: log.status,
      isLate: lateMin !== null,
      lateLabel: lateMin !== null ? formatLate(lateMin) : null,
      takenAt: log.taken_at,
      painLevel: log.pain_level,
      moodLevel: log.mood_level,
      note: log.note,
    });
  }

  return result;
}
