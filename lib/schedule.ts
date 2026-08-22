import type { Medication } from "@/lib/types/medications";

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
