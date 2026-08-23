import type {
  DoseLog,
  DoseLogStatus,
  DosePostpone,
  Medication,
  MedicationGroup,
  MedicationGroupMember,
} from "@/lib/types/medications";
import { timeToMinutes } from "@/lib/utils";

interface ResolveQuantityPerDoseArgs {
  medication: Pick<Medication, "quantity_per_dose">;
  scheduleTimeQuantityOverride?: number | null;
  groupMemberQuantityOverride?: number | null;
}

/**
 * Priority: group member override > per-slot schedule-time override >
 * medication default. Must stay the single choke point for this
 * resolution — dose recording (step 4) and any "expected dose" display
 * both depend on the same priority order.
 */
export function resolveQuantityPerDose({
  medication,
  scheduleTimeQuantityOverride,
  groupMemberQuantityOverride,
}: ResolveQuantityPerDoseArgs): number {
  return (
    groupMemberQuantityOverride ??
    scheduleTimeQuantityOverride ??
    medication.quantity_per_dose
  );
}

// Snooze duration choices offered wherever a dose can be postponed —
// single source of truth, was previously duplicated identically in
// HeroPanel.tsx and DoseRow.tsx.
export const SNOOZE_OPTIONS = [5, 10, 15, 30] as const;

export interface DaySlot {
  medicationId: string;
  medicationName: string;
  dose: string;
  scheduledTime: string; // "HH:MM"
  groupId: string | null;
  groupName: string | null;
  quantityPerDose: number;
  status: DoseLogStatus | "pending";
  takenAt: string | null;
  postponedUntil: string | null;
  medication: Medication;
}

/**
 * Builds today's (or any date's) dose slots from active medications,
 * merging in group membership, existing dose_logs, and unresolved
 * dose_postpones. Fixed-times medications get one slot per
 * medication_schedule_times row; interval medications step from
 * first_dose_time by interval_hours through the day with no
 * wraparound into the next day. as_needed medications never get slots
 * — they're logged ad hoc, not scheduled.
 *
 * Grouping is determined by matching a medication's group membership
 * (medication_group_members) against that group's scheduled_time —
 * there's no group_id column on medication_schedule_times in this
 * schema, so the match is purely on time-of-day per slot.
 */
export function generateDaySlots(
  date: string,
  medications: Medication[],
  groups: MedicationGroup[],
  groupMembers: Pick<MedicationGroupMember, "group_id" | "medication_id" | "quantity_per_dose">[],
  doseLogs: DoseLog[],
  postpones: DosePostpone[],
): DaySlot[] {
  const groupsByMedication = new Map<
    string,
    { group: MedicationGroup; override: number | null }[]
  >();
  for (const member of groupMembers) {
    const group = groups.find((g) => g.id === member.group_id);
    if (group) {
      const existing = groupsByMedication.get(member.medication_id) ?? [];
      existing.push({ group, override: member.quantity_per_dose });
      groupsByMedication.set(member.medication_id, existing);
    }
  }

  const logsByKey = new Map<string, DoseLog>();
  for (const log of doseLogs) {
    logsByKey.set(`${log.medication_id}|${log.scheduled_time.slice(0, 5)}`, log);
  }
  const postponeByKey = new Map<string, DosePostpone>();
  for (const p of postpones) {
    if (p.resolved_at) continue;
    postponeByKey.set(`${p.medication_id}|${p.scheduled_time.slice(0, 5)}`, p);
  }

  const slots: DaySlot[] = [];

  for (const med of medications) {
    if (med.as_needed) continue;
    if (!med.dashboard_enabled) continue;
    if (med.start_date && date < med.start_date) continue;
    if (med.end_date && date > med.end_date) continue;

    const medGroups = groupsByMedication.get(med.id) ?? [];
    const times: { time: string; scheduleTimeOverride: number | null }[] = [];

    if (med.schedule_mode === "fixed_times") {
      for (const st of med.medication_schedule_times ?? []) {
        times.push({
          time: st.reminder_time.slice(0, 5),
          scheduleTimeOverride: st.quantity_per_dose,
        });
      }
    } else if (med.schedule_mode === "interval" && med.interval_hours && med.first_dose_time) {
      const stepMinutes = med.interval_hours * 60;
      let minutes = timeToMinutes(med.first_dose_time.slice(0, 5));
      while (minutes < 24 * 60) {
        const h = String(Math.floor(minutes / 60)).padStart(2, "0");
        const m = String(minutes % 60).padStart(2, "0");
        times.push({ time: `${h}:${m}`, scheduleTimeOverride: null });
        minutes += stepMinutes;
      }
    }

    for (const { time, scheduleTimeOverride } of times) {
      const matchedGroup = medGroups.find(
        (g) => g.group.scheduled_time.slice(0, 5) === time,
      );
      const quantityPerDose = resolveQuantityPerDose({
        medication: med,
        scheduleTimeQuantityOverride: scheduleTimeOverride,
        groupMemberQuantityOverride: matchedGroup ? matchedGroup.override : null,
      });

      const log = logsByKey.get(`${med.id}|${time}`);
      const postpone = postponeByKey.get(`${med.id}|${time}`);

      slots.push({
        medicationId: med.id,
        medicationName: med.name,
        dose: med.dose,
        scheduledTime: time,
        groupId: matchedGroup ? matchedGroup.group.id : null,
        groupName: matchedGroup ? matchedGroup.group.name : null,
        quantityPerDose,
        status: log?.status ?? "pending",
        takenAt: log?.taken_at ?? null,
        postponedUntil: postpone?.postponed_until ?? null,
        medication: med,
      });
    }
  }

  return slots.sort(
    (a, b) => timeToMinutes(a.scheduledTime) - timeToMinutes(b.scheduledTime),
  );
}
