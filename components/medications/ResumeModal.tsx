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
import { cn } from "@/lib/cn";
import { activateMedication } from "@/lib/medications";
import type { Medication } from "@/lib/types/medications";

const REASONS = [
  "Doctor's orders",
  "Symptoms returned",
  "Retrying",
  "Restarting regimen",
  "Other",
] as const;

interface ResumeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication;
}

export function ResumeModal({ open, onOpenChange, medication }: ResumeModalProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [comment, setComment] = useState("");

  const mutation = useMutation({
    mutationFn: () => activateMedication(medication.id, reason, comment),
    onSuccess: () => {
      toast.success(`${medication.name} reactivated`);
      queryClient.invalidateQueries({ queryKey: ["medications"] });
      queryClient.invalidateQueries({ queryKey: ["dose-history", medication.id] });
      setComment("");
      setReason(REASONS[0]);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resume — {medication.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-brand-text">Reason</span>
            {REASONS.map((r) => (
              <label
                key={r}
                className="flex items-center gap-2 text-sm text-brand-text"
              >
                <input
                  type="radio"
                  name="resume-reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                />
                {r}
              </label>
            ))}
          </div>
          <Field label="Comment (optional)">
            <textarea
              rows={3}
              className={cn(inputClass, "resize-none")}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Resuming…" : "Resume"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
