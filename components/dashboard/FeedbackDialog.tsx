"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { LevelGrid } from "@/components/ui/LevelGrid";
import type { DoseFeedback } from "@/lib/dose-logs";
import type { DaySlot } from "@/lib/schedule";

interface FeedbackDialogProps {
  slot: DaySlot | null;
  onSubmit: (feedback?: DoseFeedback) => void;
  onClose: () => void;
  /** 1-based position and total size of the current feedback batch (e.g. a bulk group take). Omit, or a total of 1, for a single dose. */
  queuePosition?: number;
  queueTotal?: number;
}

/**
 * Shown after tapping Take on a medication with feedback_type !== "none"
 * (set via the step-3 wizard's StepFeedback), to capture how the dose
 * felt. Skippable — "Take without logging" records the dose the same as
 * if feedback tracking were off, rather than blocking the core Take
 * action on data entry.
 */
export function FeedbackDialog({
  slot,
  onSubmit,
  onClose,
  queuePosition,
  queueTotal,
}: FeedbackDialogProps) {
  const [painLevel, setPainLevel] = useState<number | null>(null);
  const [moodLevel, setMoodLevel] = useState<number | null>(null);
  const [note, setNote] = useState("");

  function reset() {
    setPainLevel(null);
    setMoodLevel(null);
    setNote("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSkipFeedback() {
    reset();
    onSubmit(undefined);
  }

  function handleSave() {
    onSubmit({
      painLevel: painLevel ?? undefined,
      moodLevel: moodLevel ?? undefined,
      note: note.trim() || undefined,
    });
    reset();
  }

  if (!slot) return null;

  const trackPain =
    slot.medication.feedback_type === "pain" || slot.medication.feedback_type === "both";
  const trackMood =
    slot.medication.feedback_type === "mood" || slot.medication.feedback_type === "both";

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>How are you feeling?</DialogTitle>
          <p className="text-sm text-brand-text-muted">{slot.medicationName}</p>
          {queueTotal != null && queueTotal > 1 && (
            <p className="mt-1 text-xs font-medium text-brand-deep-blue">
              {queuePosition ?? 1} of {queueTotal}
            </p>
          )}
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {trackPain && (
            <LevelGrid
              value={painLevel}
              onChange={setPainLevel}
              label="Pain level"
              hint="(1 = minimal — 10 = severe)"
            />
          )}
          {trackMood && (
            <LevelGrid
              value={moodLevel}
              onChange={setMoodLevel}
              label="Mood level"
              hint="(1 = very low — 10 = excellent)"
            />
          )}
          <label className="flex flex-col gap-1 text-sm text-brand-text">
            Notes <span className="text-xs text-brand-text-muted">(optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={255}
              placeholder="Any notes about this dose…"
              className="rounded-control border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-blue"
            />
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleSkipFeedback}>
            Take without logging
          </Button>
          <Button type="button" onClick={handleSave}>
            Save &amp; take
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
