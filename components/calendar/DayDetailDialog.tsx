"use client";

import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import type { CalendarDayDetail } from "@/lib/calendar";

function badgeVariantFor(slot: CalendarDayDetail["medications"][number]["slots"][number]): BadgeVariant {
  if (slot.status === "taken") return slot.isLate ? "late" : "taken";
  return slot.status;
}

interface DayDetailDialogProps {
  day: CalendarDayDetail | null;
  onClose: () => void;
}

export function DayDetailDialog({ day, onClose }: DayDetailDialogProps) {
  return (
    <Dialog open={day !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        {day && (
          <>
            <DialogHeader>
              <DialogTitle>
                {day.dayName}, {day.displayDate}
              </DialogTitle>
              <p className="text-sm text-brand-text-muted">
                Medications: {day.medications.length}
              </p>
            </DialogHeader>

            {day.medications.length === 0 ? (
              <p className="text-sm text-brand-text-muted">No dose data for this day.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {day.medications.map((med) => (
                  <li key={med.medicationId} className="rounded-card border border-brand-border p-3">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-brand-text">{med.name}</span>
                      {med.dose && (
                        <span className="text-sm text-brand-text-muted">{med.dose}</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-brand-text-muted">
                      Total doses {med.total} — Taken: {med.taken} / Late: {med.late} — Skipped:{" "}
                      {med.skipped} — Missed: {med.missed}
                    </p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {med.slots.map((slot) => (
                        <li
                          key={slot.logId}
                          className="flex items-center justify-between rounded-control bg-brand-bg px-2.5 py-1.5 text-sm"
                        >
                          <span className="text-brand-text">{slot.displayTime}</span>
                          <Badge variant={badgeVariantFor(slot)}>
                            {slot.status === "taken" && slot.isLate
                              ? `Taken (${slot.lateLabel})`
                              : undefined}
                          </Badge>
                        </li>
                      ))}
                    </ul>
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
