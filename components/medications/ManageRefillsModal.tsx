"use client";

import { useState, type FormEvent } from "react";
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
import { MedicationNameWithDose } from "@/components/ui/MedicationNameWithDose";
import { deleteRefill, getRefillHistory, updateRefill } from "@/lib/inventory";
import type { Medication, MedicationRefill } from "@/lib/types/medications";

interface ManageRefillsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication;
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

export function ManageRefillsModal({ open, onOpenChange, medication }: ManageRefillsModalProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<MedicationRefill | null>(null);
  const [deleting, setDeleting] = useState<MedicationRefill | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  const historyQuery = useQuery({
    queryKey: ["refill-history", medication.id],
    queryFn: () => getRefillHistory(medication.id),
    enabled: open,
  });
  const refills = (historyQuery.data ?? []).filter((e) => e.entry_type === "refill");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["medications"] });
    queryClient.invalidateQueries({ queryKey: ["refill-history", medication.id] });
    queryClient.invalidateQueries({ queryKey: ["latest-refills"] });
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      await updateRefill(editing.id, Number(amount), date, note);
    },
    onSuccess: () => {
      toast.success("Refill updated");
      invalidate();
      setEditing(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Something went wrong"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleting) return;
      await deleteRefill(deleting.id);
    },
    onSuccess: () => {
      toast.success("Refill deleted");
      invalidate();
      setDeleting(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Something went wrong"),
  });

  function startEdit(r: MedicationRefill) {
    setEditing(r);
    setAmount(String(r.amount));
    setDate(r.refill_date);
    setNote(r.note ?? "");
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Amount added must be zero or greater");
      return;
    }
    saveMutation.mutate();
  }

  const unit = medication.inventory_unit;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setEditing(null);
          setDeleting(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Edit/Delete Refill — <MedicationNameWithDose medication={medication} />
          </DialogTitle>
        </DialogHeader>

        {editing ? (
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
              <Button type="button" variant="ghost" size="compact" onClick={() => setEditing(null)}>
                Back
              </Button>
              <Button type="submit" size="compact" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        ) : deleting ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-brand-text">
              Delete the {formatDate(deleting.refill_date)} refill of {formatAmount(deleting.amount)}{" "}
              {unit}? Your current count will go down by {formatAmount(deleting.amount)} {unit}.
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="compact" onClick={() => setDeleting(null)}>
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
        ) : historyQuery.isLoading ? (
          <p className="text-sm text-brand-text-muted">Loading…</p>
        ) : refills.length === 0 ? (
          <p className="text-sm text-brand-text-muted">No refills logged yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-brand-border">
            {refills.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-navy">{formatDate(r.refill_date)}</p>
                  <p className="text-xs text-brand-text-muted">
                    +{formatAmount(r.amount)} {unit}
                    {r.note ? ` · ${r.note}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" size="compact" onClick={() => startEdit(r)}>
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    size="compact"
                    className="text-status-danger"
                    onClick={() => setDeleting(r)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
