"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { getGroupMembers, getGroups } from "@/lib/medications";
import { getTodayLogs, recordDoseAtTime } from "@/lib/dose-logs";
import { generateDaySlots, type DaySlot } from "@/lib/schedule";
import { localDateString, to12h } from "@/lib/utils";
import type { Medication } from "@/lib/types/medications";
import { DoseEntryForm, type DoseEntrySaveInput } from "./DoseEntryForm";

interface LogPastDoseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication;
}

// Already resolved — not offered in the picker, matching the
// "already logged" pattern in components/dashboard/DoseRow.tsx. A
// "missed" slot stays pickable (it already has a dose_logs row, but
// isn't done being logged — that's exactly the Missed Dose Modal case:
// correcting it to "taken").
function isTerminal(status: DaySlot["status"]): boolean {
  return status === "taken" || status === "skipped";
}

/**
 * Consolidates the spec's Slot Picker / Missed Dose / Log Past Dose /
 * Free Log modals into one flow: pick a date + a scheduled slot (or a
 * free/custom time when none fit), then a shared "actual time taken +
 * pain/mood + notes" sub-form (DoseEntryForm) to save it. Reached from
 * the medication card's action menu — replaces the old ad-hoc
 * LogDoseModal, which this is a strict superset of (that modal's
 * "today, custom time" case is exactly what an ungrouped as-needed
 * medication falls straight into here, with no picker step in between).
 */
export function LogPastDoseModal({ open, onOpenChange, medication }: LogPastDoseModalProps) {
  const queryClient = useQueryClient();
  const today = localDateString();

  const groupMembersQuery = useQuery({
    queryKey: ["group-members"],
    queryFn: getGroupMembers,
    enabled: open,
  });

  // An ungrouped as-needed medication never gets a scheduled slot for
  // any date — generateDaySlots only ever gives an as_needed medication
  // a slot when it's bundled into a group (see lib/schedule.ts). For
  // those, the date/slot-picker step would always be empty, so skip
  // straight to a free-time entry for today, matching the old
  // LogDoseModal this replaces.
  const isGrouped = (groupMembersQuery.data ?? []).some(
    (m) => m.medication_id === medication.id,
  );
  const neverScheduled = medication.as_needed && !isGrouped;

  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState<DaySlot | null>(null);
  // Whether we're on the "actual time taken" sub-form step, vs the
  // date + slot-list picker step. Combined with neverScheduled (rather
  // than seeded from it in an effect) so a medication whose grouping
  // hasn't loaded yet still lands on the picker first and jumps to the
  // form the moment neverScheduled resolves true, with no synchronous
  // setState-in-effect needed.
  const [entryStepChosen, setEntryStepChosen] = useState(false);
  const entryStep = entryStepChosen || neverScheduled;

  // Reset step state at the moment the dialog opens rather than in an
  // effect — mirrors the old LogDoseModal's onOpenChange-driven reset.
  function handleOpenChange(next: boolean) {
    if (next) {
      setDate(today);
      setSlot(null);
      setEntryStepChosen(false);
    }
    onOpenChange(next);
  }

  const groupsQuery = useQuery({
    queryKey: ["groups", medication.profile_id],
    queryFn: () => getGroups(medication.profile_id),
    enabled: open && !neverScheduled,
  });
  const logsQuery = useQuery({
    queryKey: ["dose-logs", date],
    queryFn: () => getTodayLogs(date),
    enabled: open && !neverScheduled,
  });

  const slots = useMemo<DaySlot[]>(() => {
    if (neverScheduled || !logsQuery.data) return [];
    return generateDaySlots(
      date,
      [medication],
      groupsQuery.data ?? [],
      groupMembersQuery.data ?? [],
      logsQuery.data,
      [],
    );
  }, [neverScheduled, date, medication, groupsQuery.data, groupMembersQuery.data, logsQuery.data]);

  const pickableSlots = slots.filter((s) => !isTerminal(s.status));
  const loadingSlots = groupsQuery.isLoading || logsQuery.isLoading;

  const mutation = useMutation({
    mutationFn: ({
      scheduledTime,
      takenAtIso,
      feedback,
      quantityPerDose,
    }: {
      scheduledTime: string;
      takenAtIso: string;
      feedback?: DoseEntrySaveInput["feedback"];
      quantityPerDose: number;
    }) =>
      recordDoseAtTime(medication, date, scheduledTime, takenAtIso, quantityPerDose, feedback),
    onSuccess: () => {
      toast.success(`${medication.name} logged`);
      queryClient.invalidateQueries({ queryKey: ["dose-logs"] });
      queryClient.invalidateQueries({ queryKey: ["medications"] });
      queryClient.invalidateQueries({ queryKey: ["today-history"] });
      queryClient.invalidateQueries({ queryKey: ["dose-log-history"] });
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't log dose");
    },
  });

  function handleSave(input: DoseEntrySaveInput) {
    // A picked slot keeps its own scheduled_time as the row's identity
    // (so it lines up with that slot on the dashboard/calendar) — only
    // a free-time entry uses the entered time as both the schedule key
    // and the actual time taken, same as the old ad-hoc LogDoseModal.
    const scheduledTime = slot ? slot.scheduledTime : input.time;
    const takenAtIso = new Date(`${date}T${input.time}:00`).toISOString();
    mutation.mutate({
      scheduledTime,
      takenAtIso,
      feedback: input.feedback,
      quantityPerDose: slot?.quantityPerDose ?? medication.quantity_per_dose,
    });
  }

  function pickSlot(s: DaySlot | null) {
    setSlot(s);
    setEntryStepChosen(true);
  }

  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const contextLabel = slot
    ? `${dateLabel} · scheduled for ${to12h(slot.scheduledTime)}`
    : neverScheduled
      ? undefined
      : dateLabel;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="wide">
        <DialogHeader>
          <DialogTitle>Log dose — {medication.name}</DialogTitle>
        </DialogHeader>

        {!entryStep ? (
          <div className="flex flex-col gap-4">
            <Field label="Date">
              <input
                type="date"
                className={inputClass}
                value={date}
                max={today}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSlot(null);
                }}
              />
            </Field>

            {loadingSlots ? (
              <p className="text-sm text-brand-text-muted">Loading slots…</p>
            ) : pickableSlots.length > 0 ? (
              <div className="flex flex-col gap-2">
                {pickableSlots.map((s) => (
                  <button
                    key={s.scheduledTime}
                    type="button"
                    onClick={() => pickSlot(s)}
                    className="flex items-center justify-between rounded-control border border-brand-border p-3 text-left text-sm hover:bg-brand-bg"
                  >
                    <span className="font-medium text-brand-text">{to12h(s.scheduledTime)}</span>
                    {s.status === "missed" && (
                      <span className="text-xs font-medium text-status-danger">Missed</span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-brand-text-muted">
                {slots.length === 0
                  ? "No scheduled doses for this date."
                  : "Every scheduled dose for this date is already logged."}
              </p>
            )}

            <div className="flex justify-between">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" variant="secondary" onClick={() => pickSlot(null)}>
                Log at a custom time instead
              </Button>
            </div>
          </div>
        ) : (
          <DoseEntryForm
            medication={medication}
            contextLabel={contextLabel}
            initialTime={slot?.scheduledTime}
            onBack={neverScheduled ? undefined : () => setEntryStepChosen(false)}
            onCancel={() => onOpenChange(false)}
            onSave={handleSave}
            saving={mutation.isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
