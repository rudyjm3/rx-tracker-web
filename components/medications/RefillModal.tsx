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
import { logRefill, adjustQuantity } from "@/lib/inventory";
import type { Medication } from "@/lib/types/medications";

interface RefillModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication;
  mode: "refill" | "adjust";
}

export function RefillModal({
  open,
  onOpenChange,
  medication,
  mode,
}: RefillModalProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [pillsOnHand, setPillsOnHand] = useState("");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "refill") {
        await logRefill(
          medication.id,
          Number(amount) || 0,
          pillsOnHand.trim() === "" ? null : Number(pillsOnHand),
          note,
        );
      } else {
        await adjustQuantity(medication.id, Number(pillsOnHand) || 0, note);
      }
    },
    onSuccess: () => {
      toast.success(mode === "refill" ? "Refill logged" : "Quantity adjusted");
      queryClient.invalidateQueries({ queryKey: ["medications"] });
      queryClient.invalidateQueries({ queryKey: ["refill-history", medication.id] });
      setAmount("");
      setPillsOnHand("");
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
    const pillsOnHandEntered = pillsOnHand.trim() !== "";
    if (mode === "refill" && pillsOnHandEntered) {
      const pillsOnHandValue = Number(pillsOnHand);
      if (!Number.isFinite(pillsOnHandValue) || pillsOnHandValue < 0) {
        toast.error("New total on hand must be zero or greater");
        return;
      }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "refill" ? "Log refill" : "Adjust quantity"} — {medication.name}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === "refill" && (
            <Field label={`Amount added (${medication.inventory_unit})`}>
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
          )}
          <Field
            label={
              mode === "refill"
                ? `New total on hand (${medication.inventory_unit}) — optional`
                : `Correct current quantity (${medication.inventory_unit})`
            }
          >
            <input
              type="number"
              step="any"
              min="0"
              required={mode === "adjust"}
              placeholder={
                mode === "refill"
                  ? `Leave blank to add to current (${medication.current_quantity ?? 0})`
                  : undefined
              }
              value={pillsOnHand}
              onChange={(e) => setPillsOnHand(e.target.value)}
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
              {mutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
