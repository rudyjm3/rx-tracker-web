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
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { updatePrescribedDose } from "@/lib/medications";
import type { Medication } from "@/lib/types/medications";

const doseUnits = ["mg", "mcg", "g", "mL", "tsp", "tbsp", "oz", "IU", "units", "drops", "puffs", "patches"];

function formatDoseAmount(value: number | string | null | undefined): string {
  if (value == null || value === "") return "";
  const amount = Number(value);
  return Number.isFinite(amount) ? String(amount) : "";
}

interface UpdatePrescribedDoseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication;
}

export function UpdatePrescribedDoseModal({
  open,
  onOpenChange,
  medication,
}: UpdatePrescribedDoseModalProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(formatDoseAmount(medication.dose_amount));
  const [unit, setUnit] = useState(medication.dose_unit || "mg");
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      updatePrescribedDose(
        medication.id,
        amount.trim() === "" ? null : Number(amount),
        unit,
        reason.trim(),
      ),
    onSuccess: async (didUpdate) => {
      toast.success(didUpdate ? "Prescribed dose updated" : "No dose change to save");
      if (didUpdate) {
        await queryClient.invalidateQueries({ queryKey: ["medications"] });
        await queryClient.invalidateQueries({ queryKey: ["medication", medication.id], exact: true });
        await queryClient.invalidateQueries({ queryKey: ["dose-history", medication.id] });
      }
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't update prescribed dose");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amountValue = Number(amount);
    if (!amount.trim() || !Number.isFinite(amountValue) || amountValue <= 0) {
      toast.error("New dose amount must be greater than zero");
      return;
    }
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="wide" className="max-w-5xl p-0">
        <DialogHeader className="mb-0 border-b border-brand-border px-6 py-5">
          <DialogTitle className="text-2xl">Update Prescribed Dose</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-6 px-5 py-6">
            <div>
              <p className="font-bold text-brand-text">{medication.name}</p>
              <p className="mt-2 text-brand-text-muted">
                Current dose: {formatDoseAmount(medication.dose_amount)} {medication.dose_unit}
              </p>
            </div>

            <label className="flex flex-col gap-2 text-sm font-bold text-brand-text-muted">
              New dose amount
              <div className="grid grid-cols-[1fr_8rem] gap-2">
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={cn(inputClass, "h-12 bg-brand-blue/10 text-base font-bold text-brand-text")}
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className={cn(inputClass, "h-12 bg-brand-blue/10 text-base font-bold text-brand-text")}
                >
                  {doseUnits.map((doseUnit) => (
                    <option key={doseUnit} value={doseUnit}>
                      {doseUnit}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <label className="flex flex-col gap-2 text-sm font-bold text-brand-text-muted">
              <span>
                Reason <span className="font-normal">(optional)</span>
              </span>
              <textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Doctor increased dose at last visit"
                className={cn(inputClass, "resize-none bg-brand-blue/10 text-base font-semibold")}
              />
            </label>
          </div>

          <DialogFooter className="mt-0 border-t border-brand-border px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save dose change"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
