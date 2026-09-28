"use client";

import { Layers } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { MedicationNameWithDose } from "@/components/ui/MedicationNameWithDose";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import type {
  CalendarDayDetail,
  CalendarDayEndingMedication,
  CalendarDayGroupSummary,
  CalendarDayMedicationSummary,
  CalendarDayPendingMember,
  CalendarDayPlannedSlot,
  CalendarDaySlot,
} from "@/lib/calendar";

function badgeVariantFor(slot: CalendarDayDetail["medications"][number]["slots"][number]): BadgeVariant {
  if (slot.status === "taken") return slot.isLate ? "late" : "taken";
  return slot.status;
}

// A medication's end_date lands on the viewed day — a distinct accent
// (amber) that doesn't collide with the taken/skipped/missed green/orange/
// red palette, since this isn't itself a dose outcome.
const ENDING_TODAY_CLASSES = "border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30";

function EndingTodayNote() {
  return (
    <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
      Today is the last day for this regimen.
    </p>
  );
}

function MedicationSlots({
  med,
  endingToday,
  onEditSlot,
}: {
  med: CalendarDayMedicationSummary;
  endingToday: boolean;
  onEditSlot: (slot: CalendarDaySlot) => void;
}) {
  return (
    <div>
      <MedicationNameWithDose medication={med} className="font-semibold text-brand-text" />
      {endingToday && <EndingTodayNote />}
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

// Future-day rows: the schedule's plan for that date, with no
// taken/skipped/missed status since nothing has been logged yet.
function PlannedMedicationRow({
  slot,
  endingToday,
}: {
  slot: CalendarDayPlannedSlot;
  endingToday: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-control bg-brand-bg px-2.5 py-1.5 text-sm">
      <div>
        <MedicationNameWithDose
          medication={{ name: slot.name, dose: slot.dose, dose_amount: slot.dose_amount, dose_unit: slot.dose_unit }}
          className="font-semibold text-brand-text"
        />
        {endingToday && <EndingTodayNote />}
      </div>
      <div className="flex items-center gap-2 text-xs text-brand-text-muted">
        <span>{slot.displayTime}</span>
        <span>{slot.isPrn ? "Planned (as needed)" : "Scheduled"}</span>
      </div>
    </div>
  );
}

interface DayDetailDialogProps {
  day: CalendarDayDetail | null;
  onClose: () => void;
  onEditSlot: (slot: CalendarDaySlot) => void;
  onEditGroup: (group: CalendarDayGroupSummary) => void;
  onLogPending: (member: CalendarDayPendingMember) => void;
}

function EndingTodayCallout({ endingMedications }: { endingMedications: CalendarDayEndingMedication[] }) {
  if (endingMedications.length === 0) return null;
  return (
    <div className="rounded-card border border-amber-400 bg-amber-50 p-3 dark:border-amber-600 dark:bg-amber-950/30">
      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
        {endingMedications.length === 1 ? "Regimen ending today" : "Regimens ending today"}
      </p>
      <ul className="mt-1 flex flex-col gap-0.5 text-sm text-brand-text">
        {endingMedications.map((med) => (
          <li key={med.medicationId}>
            <MedicationNameWithDose medication={med} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DayDetailDialog({
  day,
  onClose,
  onEditSlot,
  onEditGroup,
  onLogPending,
}: DayDetailDialogProps) {
  const totalMedications =
    (day?.medications.length ?? 0) +
    (day?.groups.reduce((n, g) => n + g.medications.length, 0) ?? 0);
  const totalPlanned =
    (day?.plannedMedications.length ?? 0) +
    (day?.plannedGroups.reduce((n, g) => n + g.medications.length, 0) ?? 0);
  const endingIds = new Set((day?.endingMedications ?? []).map((m) => m.medicationId));

  return (
    <Dialog open={day !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        {day && (
          <>
            <DialogHeader>
              <DialogTitle>
                {day.dayName}, {day.displayDate}
              </DialogTitle>
              <p className="text-sm text-brand-text-muted">
                {day.isFuture
                  ? `Planned doses — Required: ${day.plannedRequired} / Non-required: ${day.plannedNonRequired}`
                  : `Medications: ${totalMedications}`}
              </p>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <EndingTodayCallout endingMedications={day.endingMedications} />

              {day.isFuture ? (
                totalPlanned === 0 ? (
                  <p className="text-sm text-brand-text-muted">No doses planned for this day.</p>
                ) : (
                  <ul className="flex flex-col gap-4">
                    {day.plannedGroups.map((group) => (
                      <li key={group.groupId} className="rounded-card border border-brand-border p-3">
                        <div className="flex items-center gap-1.5 font-semibold text-brand-text">
                          <Layers size={14} className="text-brand-deep-blue" />
                          {group.groupName}
                        </div>
                        <ul className="mt-3 flex flex-col gap-2 border-t border-brand-border pt-3">
                          {group.medications.map((slot) => (
                            <li key={slot.medicationId}>
                              <PlannedMedicationRow slot={slot} endingToday={endingIds.has(slot.medicationId)} />
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                    {day.plannedMedications.map((slot) => (
                      <li key={slot.medicationId} className="rounded-card border border-brand-border p-3">
                        <PlannedMedicationRow slot={slot} endingToday={endingIds.has(slot.medicationId)} />
                      </li>
                    ))}
                  </ul>
                )
              ) : totalMedications === 0 ? (
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
                          <li
                            key={med.medicationId}
                            className={cn(
                              endingIds.has(med.medicationId) && `rounded-control border p-2 ${ENDING_TODAY_CLASSES}`,
                            )}
                          >
                            <MedicationSlots
                              med={med}
                              endingToday={endingIds.has(med.medicationId)}
                              onEditSlot={onEditSlot}
                            />
                          </li>
                        ))}
                        {group.pendingAsNeeded.map((member) => (
                          <li
                            key={member.medicationId}
                            className="flex items-center justify-between gap-2 rounded-control bg-brand-bg px-2.5 py-1.5 text-sm"
                          >
                            <MedicationNameWithDose medication={member} className="font-semibold text-brand-text" />
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-brand-text-muted">Not yet logged</span>
                              <button
                                type="button"
                                onClick={() => onLogPending(member)}
                                className="text-xs text-brand-deep-blue hover:underline"
                              >
                                Log dose
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                  {day.medications.map((med) => (
                    <li
                      key={med.medicationId}
                      className={cn(
                        "rounded-card border border-brand-border p-3",
                        endingIds.has(med.medicationId) && ENDING_TODAY_CLASSES,
                      )}
                    >
                      <MedicationSlots
                        med={med}
                        endingToday={endingIds.has(med.medicationId)}
                        onEditSlot={onEditSlot}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
