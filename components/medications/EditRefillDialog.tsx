"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { MedicationNameWithDose } from "@/components/ui/MedicationNameWithDose";
import { deleteRefill, updateRefill } from "@/lib/inventory";
import type { Medication, MedicationRefill } from "@/lib/types/medications";

interface EditRefillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication;
  refill: MedicationRefill;
  // Edit form or delete confirmation for this single refill.
  action: "edit" | "delete";
}

function formatAmount(n: number): string {
  return Number(n.toFixed(3)).toString();
}

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function EditRefillDialog({
  open,
  onOpenChange,
  medication,
  refill,
  action,
}: EditRefillDialogProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(String(refill.amount));
  const [date, setDate] = useState(refill.refill_date);
  const [note, setNote] = useState(refill.note ?? "");
  const unit = medication.inventory_unit;

  function onDone() {
    queryClient.invalidateQueries({ queryKey: ["medications"] });
    queryClient.invalidateQueries({ queryKey: ["refill-history", medication.id] });
    queryClient.invalidateQueries({ queryKey: ["latest-refills"] });
    onOpenChange(false);
  }

  const saveMutation = useMutation({
    mutationFn: () => updateRefill(refill.id, Number(amount), date, note),
    onSuccess: () => {
      toast.success("Refill updated");
      onDone();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Something went wrong"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteRefill(refill.id),
    onSuccess: () => {
      toast.success("Refill deleted");
      onDone();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Something went wrong"),
  });

  function handleSave(e: FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Amount added must be zero or greater");
      return;
    }
    saveMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action === "edit" ? "Edit refill" : "Delete refill"} —{" "}
            <MedicationNameWithDose medication={medication} />
          </DialogTitle>
        </DialogHeader>

        {action === "edit" ? (
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <Field label="Refill date">
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={`Amount added (${unit})`}>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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
            <p className="text-xs text-brand-text-muted">
              Changing the amount also adjusts your current count by the difference.
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="compact" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" size="compact" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-brand-text">
              Delete the {formatDate(refill.refill_date)} refill of {formatAmount(refill.amount)} {unit}?
              Your current count will go down by {formatAmount(refill.amount)} {unit}.
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="compact" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="compact"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete refill"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
