import type { MedicationInput, ScheduleTimeInput } from "@/lib/medications";
import type { Medication } from "@/lib/types/medications";
import type { MedicationFormValues } from "./schema";

// Numbers live in the form as strings (see schema.ts); these two
// functions are the only place that converts between that and the real
// numeric/nullable shapes the DB layer and edit-mode hydration need.
function numToStr(n: number | null | undefined): string {
  return n == null ? "" : String(n);
}

function strToNum(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function medicationToFormValues(med: Medication): MedicationFormValues {
  return {
    name: med.name,
    doseAmount: numToStr(med.dose_amount),
    doseUnit: med.dose_unit ?? "",
    doseForm: med.dose_form ?? "",
    instructions: med.instructions ?? "",
    medicationType: med.medication_type,
    asNeeded: med.as_needed,
    scheduleMode: med.schedule_mode,
    scheduleTimes: (med.medication_schedule_times ?? [])
      .slice()
      .sort((a, b) => a.reminder_time.localeCompare(b.reminder_time))
      .map((t) => ({
        reminderTime: t.reminder_time.slice(0, 5),
        quantityPerDose: numToStr(t.quantity_per_dose),
      })),
    intervalHours: numToStr(med.interval_hours),
    firstDoseTime: med.first_dose_time?.slice(0, 5) ?? "",
    startDate: med.start_date ?? "",
    endDate: med.end_date ?? "",
    inventoryEnabled: med.inventory_enabled,
    inventoryType: med.inventory_type,
    inventoryUnit: med.inventory_unit,
    startingQuantity: numToStr(med.starting_quantity),
    quantityPerDose: numToStr(med.quantity_per_dose),
    lowSupplyThreshold: numToStr(med.low_supply_threshold),
    feedbackType: med.feedback_type,
    dashboardEnabled: med.dashboard_enabled,
    remindersEnabled: med.reminders_enabled,
    adherenceEnabled: med.adherence_enabled,
  };
}

export function toScheduleTimes(values: MedicationFormValues): ScheduleTimeInput[] {
  if (values.asNeeded || values.scheduleMode !== "fixed_times") return [];
  return values.scheduleTimes.map((t) => ({
    reminder_time: t.reminderTime,
    quantity_per_dose: strToNum(t.quantityPerDose),
  }));
}

export function toMedicationInput(values: MedicationFormValues): MedicationInput {
  const isInterval = !values.asNeeded && values.scheduleMode === "interval";
  return {
    name: values.name,
    dose_amount: strToNum(values.doseAmount),
    dose_unit: values.doseUnit || null,
    dose_form: values.doseForm || null,
    instructions: values.instructions ?? "",
    medication_type: values.medicationType,
    as_needed: values.asNeeded,
    schedule_mode: values.scheduleMode,
    interval_hours: isInterval ? strToNum(values.intervalHours) : null,
    first_dose_time: isInterval ? values.firstDoseTime || null : null,
    start_date: values.startDate || null,
    end_date: values.endDate || null,
    inventory_enabled: values.inventoryEnabled,
    inventory_type: values.inventoryType,
    inventory_unit: values.inventoryUnit,
    starting_quantity: values.inventoryEnabled
      ? strToNum(values.startingQuantity)
      : null,
    quantity_per_dose: strToNum(values.quantityPerDose) ?? 1,
    low_supply_threshold: strToNum(values.lowSupplyThreshold) ?? 0,
    feedback_type: values.feedbackType,
    dashboard_enabled: values.dashboardEnabled,
    reminders_enabled: values.remindersEnabled,
    adherence_enabled: values.adherenceEnabled,
  };
}
