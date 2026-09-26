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
    // ignoreDashboardVisibility: this feeds finalizeMissedDoses only (never
    // rendered), so a dashboard-hidden but adherence-tracked medication must
    // still get its missed doses backfilled — finalizeMissedDoses itself
    // already excludes PRN and non-adherence medications.
    const slots = generateDaySlots(date, medsForDate, groups, groupMembers, [], [], {
      ignoreDashboardVisibility: true,
    });
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
  deductedQuantity: number | null;
}

export interface CalendarDayMedicationSummary {
  medicationId: string;
  name: string;
  dose: string | null;
  dose_amount: number | null;
  dose_unit: string | null;
  total: number;
  taken: number;
  late: number;
  skipped: number;
  missed: number;
  slots: CalendarDaySlot[];
}

export interface CalendarDayPendingMember {
  medicationId: string;
  name: string;
  dose: string | null;
  dose_amount: number | null;
  dose_unit: string | null;
}

export interface CalendarDayGroupSummary {
  groupId: string;
  groupName: string;
  medications: CalendarDayMedicationSummary[];
  // as-needed members of this group with no dose_logs row on this date at
  // all (an as_needed dose is never auto-finalized as "missed" — see
  // finalizeMissedDoses — so it would otherwise be silently invisible here
  // once its required groupmates already have a logged/missed entry).
  pendingAsNeeded: CalendarDayPendingMember[];
}

export interface CalendarDayDetail {
  date: string;
  dayName: string; // e.g. "Friday"
  displayDate: string; // e.g. "August 22, 2026"
  medications: CalendarDayMedicationSummary[]; // medications with no single shared group that day
  groups: CalendarDayGroupSummary[]; // medications sharing a group that day, nested under it
}

/**
 * Groups a month's raw dose_logs into per-day, per-medication summaries
 * for the day-detail view — port of the reference PHP app's
 * $calendarDayData building loop in routes/calendar.php. Also clusters
 * medications sharing a group into `day.groups`, resolved the same way
 * generateDaySlots resolves group membership post-Part-1: via the FK on
 * the medication's own medication_schedule_times row for that reminder
 * time (`group_id`), never by comparing time-of-day strings.
 *
 * A medication only lands in `day.groups` when *every* dose it logged
 * that day resolves to the exact same group — a medication with a mix of
 * grouped and individual (or multiple different groups') doses the same
 * day is left in the flat `medications` list instead of guessing which
 * single group it "belongs to" for the day.
 *
 * Each resulting group is also annotated with `pendingAsNeeded`: any
 * as_needed member of that group (via `groupMembers`) that has no
 * dose_logs row at all on that date and was actually active/in-range on
 * that date (per `statusEvents` and its own start/end dates, the same
 * eligibility `backfillMonth` uses) — see `CalendarDayPendingMember`. A
 * group can owe a pending member even on a date where its only *other*
 * logged medication didn't cleanly bucket into that group (e.g. it also
 * logged an individual dose that day) — group candidacy for pending
 * purposes is tracked per logged slot, not just per finalized bucket.
 */
export function buildDayDetails(
  logs: CalendarLogRow[],
  graceMinutes: number,
  medications: Pick<
    Medication,
    | "id"
    | "name"
    | "dose"
    | "dose_amount"
    | "dose_unit"
    | "as_needed"
    | "start_date"
    | "end_date"
    | "medication_schedule_times"
  >[],
  groups: MedicationGroup[],
  groupMembers: Pick<MedicationGroupMember, "group_id" | "medication_id">[],
  statusEvents: MedicationStatusEvent[],
): Record<string, CalendarDayDetail> {
  const groupIdByMedTime = new Map<string, string>();
  for (const med of medications) {
    for (const st of med.medication_schedule_times ?? []) {
      if (st.group_id) {
        groupIdByMedTime.set(`${med.id}|${st.reminder_time.slice(0, 5)}`, st.group_id);
      }
    }
  }
  const groupsById = new Map(groups.map((g) => [g.id, g]));
  const medsById = new Map(medications.map((m) => [m.id, m]));
  const memberIdsByGroup = new Map<string, string[]>();
  for (const member of groupMembers) {
    const existing = memberIdsByGroup.get(member.group_id) ?? [];
    existing.push(member.medication_id);
    memberIdsByGroup.set(member.group_id, existing);
  }

  const result: Record<string, CalendarDayDetail> = {};
  // Per date, per medication: every group_id (or null, for an individual
  // dose) its logged slots resolved to that day — used below to decide
  // whether the medication can be nested under one shared group.
  const groupIdsByDateAndMedication = new Map<string, Map<string, Set<string | null>>>();

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
        groups: [],
      };
      result[date] = day;
    }

    let med = day.medications.find((m) => m.medicationId === log.medication_id);
    if (!med) {
      med = {
        medicationId: log.medication_id,
        name: log.medications.name,
        dose: log.medications.dose,
        dose_amount: log.medications.dose_amount,
        dose_unit: log.medications.dose_unit,
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
      deductedQuantity: log.deducted_quantity,
    });

    const groupId = groupIdByMedTime.get(`${log.medication_id}|${time}`) ?? null;
    let byMedication = groupIdsByDateAndMedication.get(date);
    if (!byMedication) {
      byMedication = new Map();
      groupIdsByDateAndMedication.set(date, byMedication);
    }
    const ids = byMedication.get(log.medication_id) ?? new Set<string | null>();
    ids.add(groupId);
    byMedication.set(log.medication_id, ids);
  }

  for (const [date, day] of Object.entries(result)) {
    const byMedication = groupIdsByDateAndMedication.get(date) ?? new Map();
    // Every medication with *any* log that day, regardless of which group
    // bucket (if any) it ended up in — a grouped PRN logged at a custom
    // time that doesn't resolve to the group-owned schedule row still
    // counts as logged, and must not also show as pending.
    const loggedMedicationIds = new Set(byMedication.keys());
    // Every group any logged slot resolved to that day — broader than
    // groupBuckets' keys, since a medication with a mix of grouped and
    // individual doses that day is deliberately left out of groupBuckets
    // (see above) but its groupmates can still owe a pending member.
    const candidateGroupIds = new Set<string>();
    for (const ids of byMedication.values()) {
      for (const id of ids) {
        if (id) candidateGroupIds.add(id);
      }
    }

    const ungrouped: CalendarDayMedicationSummary[] = [];
    const groupBuckets = new Map<string, CalendarDayMedicationSummary[]>();

    for (const med of day.medications) {
      const ids = byMedication.get(med.medicationId) ?? new Set<string | null>();
      const groupId = ids.size === 1 ? [...ids][0] : null;
      if (groupId && groupsById.has(groupId)) {
        const bucket = groupBuckets.get(groupId) ?? [];
        bucket.push(med);
        groupBuckets.set(groupId, bucket);
      } else {
        ungrouped.push(med);
      }
    }

    function pendingAsNeededFor(groupId: string): CalendarDayPendingMember[] {
      return (memberIdsByGroup.get(groupId) ?? [])
        .filter((id) => !loggedMedicationIds.has(id))
        .map((id) => medsById.get(id))
        .filter((m): m is NonNullable<typeof m> => !!m && m.as_needed)
        .filter(
          (m) =>
            (!m.start_date || date >= m.start_date) &&
            (!m.end_date || date <= m.end_date) &&
            wasActiveOnDate(m.id, date, statusEvents),
        )
        .map((m) => ({
          medicationId: m.id,
          name: m.name,
          dose: m.dose,
          dose_amount: m.dose_amount,
          dose_unit: m.dose_unit,
        }));
    }

    day.medications = ungrouped;
    const groups: CalendarDayGroupSummary[] = [...groupBuckets.entries()].map(([groupId, meds]) => ({
      groupId,
      groupName: groupsById.get(groupId)!.name,
      medications: meds,
      pendingAsNeeded: pendingAsNeededFor(groupId),
    }));

    for (const groupId of candidateGroupIds) {
      if (groupBuckets.has(groupId) || !groupsById.has(groupId)) continue;
      const pendingAsNeeded = pendingAsNeededFor(groupId);
      if (pendingAsNeeded.length === 0) continue;
      groups.push({
        groupId,
        groupName: groupsById.get(groupId)!.name,
        medications: [],
        pendingAsNeeded,
      });
    }

    day.groups = groups;
  }

  return result;
}
