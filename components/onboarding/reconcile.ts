import type { ParsedDraft } from "@/lib/drafts";
import type { MedicationFormValues } from "@/components/medications/wizard/schema";
import { timeToMinutes } from "@/lib/utils";

export interface ReconcileSlot {
  draftId: string;
  medicationName: string;
  scheduledTime: string; // "HH:MM"
  quantityPerDose: number;
}

/**
 * Today's dose slots that have already passed, built directly from each
 * draft's MedicationFormValues — mirrors lib/schedule.ts's
 * generateDaySlots (fixed-times → one slot per reminder time,
 * interval → step from firstDoseTime by intervalHours), but can't reuse
 * it directly since these medications don't have real DB rows yet.
 */
export function buildTodayReconcileSlots(
  drafts: ParsedDraft<MedicationFormValues>[],
  now: Date = new Date(),
): ReconcileSlot[] {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const slots: ReconcileSlot[] = [];

  for (const draft of drafts) {
    const values = draft.formData;
    if (values.asNeeded) continue;

    const defaultQty = Number(values.quantityPerDose) || 1;
    const times: { time: string; quantityPerDose: number }[] = [];

    if (values.scheduleMode === "fixed_times") {
      for (const t of values.scheduleTimes) {
        if (!t.reminderTime) continue;
        times.push({
          time: t.reminderTime,
          quantityPerDose: Number(t.quantityPerDose) || defaultQty,
        });
      }
    } else if (values.scheduleMode === "interval") {
      const intervalHours = Number(values.intervalHours);
      if (values.firstDoseTime && intervalHours > 0) {
        const stepMinutes = intervalHours * 60;
        let minutes = timeToMinutes(values.firstDoseTime);
        while (minutes < 24 * 60) {
          const h = String(Math.floor(minutes / 60)).padStart(2, "0");
          const m = String(minutes % 60).padStart(2, "0");
          times.push({ time: `${h}:${m}`, quantityPerDose: defaultQty });
          minutes += stepMinutes;
        }
      }
    }

    for (const { time, quantityPerDose } of times) {
      if (timeToMinutes(time) >= nowMinutes) continue;
      slots.push({
        draftId: draft.id,
        medicationName: values.name || "Medication",
        scheduledTime: time,
        quantityPerDose,
      });
    }
  }

  return slots.sort((a, b) => timeToMinutes(a.scheduledTime) - timeToMinutes(b.scheduledTime));
}
