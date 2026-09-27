"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Field, inputClass } from "@/components/ui/Field";

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface AlarmTimeStepDialogProps {
  open: boolean;
  /** Context text for the event's original scheduled/due time, e.g. "Originally due 8:00 AM". */
  dueLabel: string | null;
  onSubmit: (time: string) => void;
  onCancel: () => void;
  submitting: boolean;
}

/**
 * Shared "what time did you actually take this" step for the alarm
 * overlay's Take flow — shown once, after any per-slot feedback capture,
 * for the whole affected set (a single dose or every non-terminal member
 * of a group). Deliberately its own small dialog rather than reusing
 * DoseEntryForm, which bundles feedback into the same step.
 */
export function AlarmTimeStepDialog({
  open,
  dueLabel,
  onSubmit,
  onCancel,
  submitting,
}: AlarmTimeStepDialogProps) {
  const [time, setTime] = useState(nowHHMM);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(time);
  }

  if (!open) return null;

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What time did you take this?</DialogTitle>
          {dueLabel && <p className="text-sm text-brand-text-muted">{dueLabel}</p>}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Actual time taken">
            <input
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={inputClass}
              disabled={submitting}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Recording…" : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
