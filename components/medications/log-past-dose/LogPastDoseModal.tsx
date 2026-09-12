"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Field, inputClass } from "@/components/ui/Field";
import { MedicationNameWithDose } from "@/components/ui/MedicationNameWithDose";
import { getTodayLogs, recordDoseAtTime } from "@/lib/dose-logs";
import { formatMedicationNameDose } from "@/lib/medication-label";
import { getGroupMembers, getGroups } from "@/lib/medications";
import { generateDaySlots, type DaySlot } from "@/lib/schedule";
import { localDateString, to12h } from "@/lib/utils";
import type { Medication } from "@/lib/types/medications";
import { DoseEntryForm, type DoseEntrySaveInput } from "./DoseEntryForm";

interface LogPastDoseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication;
}

function isTerminal(status: DaySlot["status"]): boolean {
  return status === "taken" || status === "skipped";
}

export function LogPastDoseModal({ open, onOpenChange, medication }: LogPastDoseModalProps) {
  const queryClient = useQueryClient();
  const today = localDateString();

  const groupMembersQuery = useQuery({
    queryKey: ["group-members"],
    queryFn: getGroupMembers,
    enabled: open,
  });

  const isGrouped = (groupMembersQuery.data ?? []).some(
    (m) => m.medication_id === medication.id,
  );
  const neverScheduled = medication.as_needed && groupMembersQuery.isSuccess && !isGrouped;
  const resolvingPrnGrouping = medication.as_needed && groupMembersQuery.isPending;
  const groupMembershipError = medication.as_needed && groupMembersQuery.isError;

  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState<DaySlot | null>(null);
  const [entryStepChosen, setEntryStepChosen] = useState(false);
  const entryStep = entryStepChosen || neverScheduled;

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
    enabled: open && !neverScheduled && !groupMembershipError,
  });
  const logsQuery = useQuery({
    queryKey: ["dose-logs", date],
    queryFn: () => getTodayLogs(date),
    enabled: open && !neverScheduled && !groupMembershipError,
  });

  const slots = useMemo<DaySlot[]>(() => {
    if (resolvingPrnGrouping || neverScheduled || groupMembershipError || !logsQuery.data) {
      return [];
    }
    return generateDaySlots(
      date,
      [medication],
      groupsQuery.data ?? [],
      groupMembersQuery.data ?? [],
      logsQuery.data,
      [],
    );
  }, [
    resolvingPrnGrouping,
    neverScheduled,
    groupMembershipError,
    date,
    medication,
    groupsQuery.data,
    groupMembersQuery.data,
    logsQuery.data,
  ]);

  const pickableSlots = slots.filter((s) => !isTerminal(s.status));
  const loadingSlots = resolvingPrnGrouping || groupsQuery.isLoading || logsQuery.isLoading;

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
    }) => recordDoseAtTime(medication, date, scheduledTime, takenAtIso, quantityPerDose, feedback),
    onSuccess: () => {
      toast.success(`${formatMedicationNameDose(medication)} logged`);
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
    ? `${dateLabel} - scheduled for ${to12h(slot.scheduledTime)}`
    : neverScheduled
      ? undefined
      : dateLabel;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="wide">
        <DialogHeader>
          <DialogTitle>
            Log dose -{" "}
            <MedicationNameWithDose
              medication={medication}
              doseClassName="text-sm font-bold text-brand-text-muted"
            />
          </DialogTitle>
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

            {groupMembershipError ? (
              <div className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3">
                <p className="text-sm text-status-danger">
                  Couldn&apos;t load medication groups. Try again before logging this as-needed dose.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  className="mt-3"
                  onClick={() => groupMembersQuery.refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : loadingSlots ? (
              <p className="text-sm text-brand-text-muted">Loading slots...</p>
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
