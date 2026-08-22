"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Field, inputClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  addSideEffect,
  deleteSideEffect,
  getSideEffects,
} from "@/lib/side-effects";
import type { Medication, SideEffectSeverity } from "@/lib/types/medications";

const SEVERITY_STYLES: Record<SideEffectSeverity, string> = {
  mild: "bg-status-success/10 text-status-success",
  moderate: "bg-status-warning/10 text-status-warning",
  severe: "bg-status-danger/10 text-status-danger",
};

interface SideEffectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication;
}

export function SideEffectModal({
  open,
  onOpenChange,
  medication,
}: SideEffectModalProps) {
  const queryClient = useQueryClient();
  const [occurredDate, setOccurredDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<SideEffectSeverity>("mild");

  const { data: sideEffects } = useQuery({
    queryKey: ["side-effects", medication.id],
    queryFn: () => getSideEffects(medication.id),
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: () =>
      addSideEffect(medication.id, { occurred_date: occurredDate, description, severity }),
    onSuccess: () => {
      toast.success("Side effect logged");
      queryClient.invalidateQueries({ queryKey: ["side-effects", medication.id] });
      setDescription("");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSideEffect(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["side-effects", medication.id] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    addMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Side effects — {medication.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mb-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input
                type="date"
                value={occurredDate}
                onChange={(e) => setOccurredDate(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Severity">
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as SideEffectSeverity)}
                className={inputClass}
              >
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
              </select>
            </Field>
          </div>
          <Field label="Description">
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Button type="submit" size="compact" className="self-start" disabled={addMutation.isPending}>
            {addMutation.isPending ? "Saving…" : "Add side effect"}
          </Button>
        </form>

        <div className="flex max-h-56 flex-col gap-2 overflow-auto">
          {sideEffects?.length === 0 && (
            <p className="text-sm text-brand-text-muted">No side effects logged yet.</p>
          )}
          {sideEffects?.map((se) => (
            <div
              key={se.id}
              className="flex items-start justify-between gap-2 rounded-control border border-brand-border p-2"
            >
              <div>
                <span
                  className={cn(
                    "mr-2 rounded-full px-2 py-0.5 text-xs font-medium",
                    SEVERITY_STYLES[se.severity],
                  )}
                >
                  {se.severity}
                </span>
                <span className="text-sm text-brand-text">{se.description}</span>
                <p className="text-xs text-brand-text-muted">{se.occurred_date}</p>
              </div>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(se.id)}
                className="text-brand-text-muted hover:text-status-danger"
                aria-label="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
