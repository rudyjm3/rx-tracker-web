"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { RefillModal } from "@/components/medications/RefillModal";
import { adjustQuantity } from "@/lib/inventory";
import type { DaySlot } from "@/lib/schedule";

interface ZeroPillModalProps {
  slot: DaySlot | null;
  onClose: () => void;
  /** "Not Now" — proceed with taking the dose without correcting the count. */
  onTakeAnyway: () => void;
  /** "Cancel dose" — abort, nothing is recorded. */
  onCancelDose: () => void;
}

/**
 * Interrupts Take when a medication's current_quantity is already at (or
 * below) zero — the count is more likely stale than the medication truly
 * being unavailable, so this offers a quick correction before falling
 * through to actually recording the dose.
 */
export function ZeroPillModal({ slot, onClose, onTakeAnyway, onCancelDose }: ZeroPillModalProps) {
  const queryClient = useQueryClient();
  const [count, setCount] = useState(0);
  const [refillOpen, setRefillOpen] = useState(false);

  const medication = slot?.medication ?? null;

  const updateMutation = useMutation({
    mutationFn: () => adjustQuantity(medication!.id, count),
    onSuccess: () => {
      toast.success("Quantity updated");
      queryClient.invalidateQueries({ queryKey: ["medications"] });
      onTakeAnyway();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't update quantity");
    },
  });

  if (!slot || !medication) return null;

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Out of {medication.inventory_unit}</DialogTitle>
            <p className="text-sm text-brand-text-muted">
              {medication.name} shows 0 {medication.inventory_unit} on hand.
            </p>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-1 text-sm font-medium text-brand-text">
                Correct the count, if it&apos;s wrong
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCount((c) => Math.max(0, c - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-control border border-brand-border text-brand-navy hover:bg-brand-bg"
                  aria-label="Decrease"
                >
                  <Minus size={16} />
                </button>
                <span className="min-w-[3ch] text-center text-lg font-semibold text-brand-text">
                  {count}
                </span>
                <button
                  type="button"
                  onClick={() => setCount((c) => c + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-control border border-brand-border text-brand-navy hover:bg-brand-bg"
                  aria-label="Increase"
                >
                  <Plus size={16} />
                </button>
                <span className="text-sm text-brand-text-muted">{medication.inventory_unit}</span>
                <Button
                  size="compact"
                  className="ml-auto"
                  onClick={() => updateMutation.mutate()}
                  disabled={count <= 0 || updateMutation.isPending}
                >
                  {updateMutation.isPending ? "Updating…" : "Update & take"}
                </Button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setRefillOpen(true)}
              className="text-left text-sm font-medium text-brand-deep-blue hover:underline"
            >
              Log refill instead
            </button>
          </div>

          <DialogFooter className="justify-between">
            <button
              type="button"
              onClick={onTakeAnyway}
              className="text-sm text-brand-text-muted hover:underline"
            >
              Not now
            </button>
            <Button variant="danger" onClick={onCancelDose}>
              Cancel dose
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RefillModal
        open={refillOpen}
        onOpenChange={setRefillOpen}
        medication={medication}
        mode="refill"
      />
    </>
  );
}
