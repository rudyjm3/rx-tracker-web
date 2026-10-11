"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { MedicationNameWithDose } from "@/components/ui/MedicationNameWithDose";
import { LogPastDoseModal } from "@/components/medications/log-past-dose/LogPastDoseModal";
import type { Medication, MedicationGroup, MedicationGroupMember } from "@/lib/types/medications";

interface AsNeededListProps {
  medications: Medication[];
  groups: Pick<MedicationGroup, "id">[];
  groupMembers: Pick<MedicationGroupMember, "group_id" | "medication_id">[];
  date: string;
}

/**
 * Ungrouped as_needed medications never get a scheduled slot, so they
 * can't be taken from the schedule list above — list them here with a
 * Log dose action instead. Grouped as_needed members already appear
 * inside their group's card.
 */
export function AsNeededList({ medications, groups, groupMembers, date }: AsNeededListProps) {
  const [logging, setLogging] = useState<Medication | null>(null);

  // Only memberships of active groups count — `groups` excludes deactivated
  // ones, which generateDaySlots can't slot a med into.
  const activeGroupIds = new Set(groups.map((g) => g.id));
  const groupedIds = new Set(
    groupMembers.filter((m) => activeGroupIds.has(m.group_id)).map((m) => m.medication_id),
  );
  const items = medications.filter(
    (m) =>
      m.as_needed &&
      m.dashboard_enabled &&
      !groupedIds.has(m.id) &&
      (!m.start_date || date >= m.start_date) &&
      (!m.end_date || date <= m.end_date),
  );

  if (items.length === 0) return null;

  return (
    <div className="mt-4 border-t border-brand-border pt-3">
      <h3 className="mb-2 text-sm font-semibold text-brand-navy">As needed</h3>
      <ul className="flex flex-col gap-2">
        {items.map((med) => (
          <li
            key={med.id}
            className="flex items-center justify-between gap-2 rounded-control bg-brand-bg px-3 py-2 text-sm"
          >
            <MedicationNameWithDose medication={med} className="font-semibold text-brand-text" />
            <Button type="button" size="compact" variant="secondary" onClick={() => setLogging(med)}>
              Log dose
            </Button>
          </li>
        ))}
      </ul>
      {logging && (
        <LogPastDoseModal
          open
          onOpenChange={(open) => {
            if (!open) setLogging(null);
          }}
          medication={logging}
          initialDate={date}
        />
      )}
    </div>
  );
}
