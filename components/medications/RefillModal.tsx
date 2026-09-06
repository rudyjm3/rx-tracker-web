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
import { logRefill, adjustQuantity } from "@/lib/inventory";
import { localDateString } from "@/lib/utils";
import type { Medication } from "@/lib/types/medications";

interface RefillModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication;
  mode: "refill" | "adjust";
}

function UnitInput({
  value,
  onChange,
  placeholder,
  unit,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  unit: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        step="any"
        min="0"
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass + " flex-1"}
      />
      <span className="text-sm font-medium text-brand-text-muted">{unit}</span>
    </div>
  );
}

export function RefillModal({
  open,
  onOpenChange,
  medication,
  mode,
}: RefillModalProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [pillsOnHand, setPillsOnHand] = useState(
    medication.current_quantity == null ? "" : String(medication.current_quantity),
  );
  const [refillDate, setRefillDate] = useState(localDateString());
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "refill") {
        await logRefill(medication.id, Number(amount) || 0, null, note, refillDate);
      } else {
        await adjustQuantity(medication.id, Number(pillsOnHand) || 0, note);
      }
    },
    onSuccess: () => {
      toast.success(mode === "refill" ? "Refill logged" : "Quantity adjusted");
      queryClient.invalidateQueries({ queryKey: ["medications"] });
      queryClient.invalidateQueries({ queryKey: ["refill-history", medication.id] });
      setAmount("");
      setPillsOnHand(medication.current_quantity == null ? "" : String(medication.current_quantity));
      setRefillDate(localDateString());
      setNote("");
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amountValue = Number(amount);
    if (mode === "refill" && (!Number.isFinite(amountValue) || amountValue < 0)) {
      toast.error("Amount added must be zero or greater");
      return;
    }
    if (mode === "adjust") {
      const pillsOnHandValue = Number(pillsOnHand);
      if (!Number.isFinite(pillsOnHandValue) || pillsOnHandValue < 0) {
        toast.error("Quantity must be zero or greater");
        return;
      }
    }
    mutation.mutate();
  }

  const title = mode === "refill" ? "Log refill" : "Adjust quantity";
  const actionLabel = mode === "refill" ? "Log refill" : "Save adjustment";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {title} — {medication.name}{" "}
            <span className="text-sm font-bold text-brand-text-muted">{medication.dose}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === "refill" ? (
            <>
              <Field label="Refill date">
                <input
                  type="date"
                  required
                  value={refillDate}
                  onChange={(e) => setRefillDate(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label={`Amount added (${medication.inventory_unit})`}>
                <UnitInput
                  value={amount}
                  onChange={setAmount}
                  placeholder="e.g. 30"
                  unit={medication.inventory_unit}
                  required
                />
              </Field>
              <Field label="Note (optional)">
                <input
                  type="text"
                  value={note}
                  placeholder="e.g. 30-day supply"
                  onChange={(e) => setNote(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </>
          ) : (
            <>
              <p className="text-sm text-brand-text-muted">
                Current count: {medication.current_quantity ?? 0} {medication.inventory_unit}
              </p>
              <Field label={`Correct current quantity (${medication.inventory_unit})`}>
                <UnitInput
                  value={pillsOnHand}
                  onChange={setPillsOnHand}
                  unit={medication.inventory_unit}
                  required
                />
              </Field>
              <Field label="Reason (optional)">
                <input
                  type="text"
                  value={note}
                  placeholder="e.g. recount, dropped a pill"
                  onChange={(e) => setNote(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="compact" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="compact" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : actionLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
