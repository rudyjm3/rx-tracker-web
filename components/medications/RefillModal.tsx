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
    <div className="flex items-center gap-3">
      <input
        type="number"
        step="any"
        min="0"
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputClass, "h-12 flex-1 bg-brand-bg px-5 text-base font-semibold")}
      />
      <span className="min-w-10 text-sm font-bold text-brand-text-muted">{unit}</span>
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

  const title = mode === "refill" ? "Log Refill" : "Adjust Quantity";
  const actionLabel = mode === "refill" ? "Log refill" : "Save adjustment";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0">
        <DialogHeader className="mb-0 border-b border-brand-border px-6 py-5">
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          <p className="mt-2 flex items-center gap-3 text-base font-bold text-brand-text-muted">
            <span>{medication.name}</span>
            <span className="text-sm">{medication.dose}</span>
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-5 px-6 py-5">
            {mode === "refill" ? (
              <>
                <label className="flex flex-col gap-2 text-base font-bold text-brand-text-muted">
                  Refill date
                  <input
                    type="date"
                    required
                    value={refillDate}
                    onChange={(e) => setRefillDate(e.target.value)}
                    className={cn(inputClass, "h-12 bg-brand-bg px-5 text-base font-semibold")}
                  />
                </label>
                <label className="flex flex-col gap-2 text-base font-bold text-brand-text-muted">
                  Amount
                  <UnitInput
                    value={amount}
                    onChange={setAmount}
                    placeholder="e.g. 30"
                    unit={medication.inventory_unit}
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-base font-bold text-brand-text-muted">
                  <span>
                    Note <span className="block font-normal">(optional)</span>
                  </span>
                  <input
                    type="text"
                    value={note}
                    placeholder="e.g. 30-day supply"
                    onChange={(e) => setNote(e.target.value)}
                    className={cn(inputClass, "h-12 bg-brand-bg px-5 text-base font-semibold")}
                  />
                </label>
              </>
            ) : (
              <>
                <p className="text-sm text-brand-navy">
                  Corrects the on-hand count without resetting the supply bar. Current count:{" "}
                  <span className="font-bold">
                    {medication.current_quantity ?? 0} {medication.inventory_unit}
                  </span>
                </p>
                <label className="flex flex-col gap-2 text-base font-bold text-brand-text-muted">
                  Corrected count
                  <UnitInput
                    value={pillsOnHand}
                    onChange={setPillsOnHand}
                    unit={medication.inventory_unit}
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-base font-bold text-brand-text-muted">
                  <span>
                    Reason <span className="block font-normal">(optional)</span>
                  </span>
                  <input
                    type="text"
                    value={note}
                    placeholder="e.g. recount, dropped a pill"
                    onChange={(e) => setNote(e.target.value)}
                    className={cn(inputClass, "h-12 bg-brand-bg px-5 text-base font-semibold")}
                  />
                </label>
              </>
            )}
          </div>

          <DialogFooter className="mt-0 justify-between border-t border-brand-border px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="px-6 py-3 text-base">
              {mutation.isPending ? "Saving…" : actionLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
