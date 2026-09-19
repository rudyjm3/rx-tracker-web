"use client";

import { Layers } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { MedicationNameWithDose } from "@/components/ui/MedicationNameWithDose";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import type {
  CalendarDayDetail,
  CalendarDayGroupSummary,
  CalendarDayMedicationSummary,
  CalendarDaySlot,
} from "@/lib/calendar";

function badgeVariantFor(slot: CalendarDayDetail["medications"][number]["slots"][number]): BadgeVariant {
  if (slot.status === "taken") return slot.isLate ? "late" : "taken";
  return slot.status;
}

function MedicationSlots({
  med,
  onEditSlot,
}: {
  med: CalendarDayMedicationSummary;
  onEditSlot: (slot: CalendarDaySlot) => void;
}) {
  return (
    <div>
      <MedicationNameWithDose medication={med} className="font-semibold text-brand-text" />
      <p className="mt-1 text-xs text-brand-text-muted">
        Total doses {med.total} — Taken: {med.taken} / Late: {med.late} — Skipped: {med.skipped} —
        Missed: {med.missed}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {med.slots.map((slot) => (
          <li
            key={slot.logId}
            className="flex items-center justify-between rounded-control bg-brand-bg px-2.5 py-1.5 text-sm"
          >
            <span className="text-brand-text">{slot.displayTime}</span>
            <div className="flex items-center gap-2">
              <Badge variant={badgeVariantFor(slot)}>
                {slot.status === "taken" && slot.isLate ? `Taken (${slot.lateLabel})` : undefined}
              </Badge>
              <button
                type="button"
                onClick={() => onEditSlot(slot)}
                className="text-xs text-brand-deep-blue hover:underline"
              >
                Edit
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface DayDetailDialogProps {
  day: CalendarDayDetail | null;
  onClose: () => void;
  onEditSlot: (slot: CalendarDaySlot) => void;
  onEditGroup: (group: CalendarDayGroupSummary) => void;
}

export function DayDetailDialog({ day, onClose, onEditSlot, onEditGroup }: DayDetailDialogProps) {
  const totalMedications =
    (day?.medications.length ?? 0) +
    (day?.groups.reduce((n, g) => n + g.medications.length, 0) ?? 0);

  return (
    <Dialog open={day !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        {day && (
          <>
            <DialogHeader>
              <DialogTitle>
                {day.dayName}, {day.displayDate}
              </DialogTitle>
              <p className="text-sm text-brand-text-muted">Medications: {totalMedications}</p>
            </DialogHeader>

            {totalMedications === 0 ? (
              <p className="text-sm text-brand-text-muted">No dose data for this day.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {day.groups.map((group) => (
                  <li key={group.groupId} className="rounded-card border border-brand-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-semibold text-brand-text">
                        <Layers size={14} className="text-brand-deep-blue" />
                        {group.groupName}
                      </div>
                      <button
                        type="button"
                        onClick={() => onEditGroup(group)}
                        className="text-xs font-medium text-brand-deep-blue hover:underline"
                      >
                        Edit all
                      </button>
                    </div>
                    <ul className="mt-3 flex flex-col gap-3 border-t border-brand-border pt-3">
                      {group.medications.map((med) => (
                        <li key={med.medicationId}>
                          <MedicationSlots med={med} onEditSlot={onEditSlot} />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
                {day.medications.map((med) => (
                  <li key={med.medicationId} className="rounded-card border border-brand-border p-3">
                    <MedicationSlots med={med} onEditSlot={onEditSlot} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
