"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Field, inputClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { recordDose } from "@/lib/dose-logs";
import { localDateString } from "@/lib/utils";
import type { Medication } from "@/lib/types/medications";

interface LogDoseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication;
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Ad-hoc "I took this" logger, reached from the medication card's action
// menu — the only way to log a dose for an ungrouped as-needed (PRN)
// medication, since generateDaySlots() never gives those a dashboard
// slot (see lib/schedule.ts). Logs "taken" for today at a chosen time,
// same recordDose RPC the dashboard's Take button uses.
export function LogDoseModal({ open, onOpenChange, medication }: LogDoseModalProps) {
  const queryClient = useQueryClient();
  const [time, setTime] = useState(nowHHMM);
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      recordDose(
        medication,
        localDateString(),
        time,
        "taken",
        medication.quantity_per_dose,
        note ? { note } : undefined,
      ),
    onSuccess: () => {
      toast.success(`${medication.name} logged as taken`);
      queryClient.invalidateQueries({ queryKey: ["dose-logs"] });
      queryClient.invalidateQueries({ queryKey: ["today-history"] });
      queryClient.invalidateQueries({ queryKey: ["medications"] });
      setNote("");
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setTime(nowHHMM());
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log dose — {medication.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Time taken">
            <input
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Note (optional)">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass}
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Logging…" : "Log dose"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
