"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { DialogFooter } from "@/components/ui/Dialog";
import { Field, inputClass } from "@/components/ui/Field";
import { LevelGrid } from "@/components/ui/LevelGrid";
import { medicationTracksMood, medicationTracksPain } from "@/lib/pain-mood";
import type { DoseFeedback } from "@/lib/dose-logs";
import type { Medication } from "@/lib/types/medications";

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export interface DoseEntrySaveInput {
  time: string; // "HH:MM" — the actual time taken
  feedback?: DoseFeedback;
}

interface DoseEntryFormProps {
  medication: Medication;
  /** Context line shown above the time input, e.g. "Sat, Aug 29 · scheduled for 8:00 AM". */
  contextLabel?: string;
  initialTime?: string;
  onBack?: () => void;
  onCancel: () => void;
  onSave: (input: DoseEntrySaveInput) => void;
  saving: boolean;
}

/**
 * Shared "actual time taken" sub-form — reused for every one of the spec's
 * Slot Picker / Missed Dose / Log Past Dose / Free Log flows once a slot
 * or a free time has been chosen (see LogPastDoseModal). Mirrors the house
 * pattern from components/history/EditDoseLogDialog.tsx (LevelGrid for
 * 1-10 pickers, medicationTracksPain/medicationTracksMood to gate them,
 * Field/inputClass for inputs) rather than inventing a new shape.
 */
export function DoseEntryForm({
  medication,
  contextLabel,
  initialTime,
  onBack,
  onCancel,
  onSave,
  saving,
}: DoseEntryFormProps) {
  const [time, setTime] = useState(initialTime ?? nowHHMM);
  const [painLevel, setPainLevel] = useState<number | null>(null);
  const [moodLevel, setMoodLevel] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const trackPain = medicationTracksPain(medication);
  const trackMood = medicationTracksMood(medication);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedNote = note.trim();
    const feedback: DoseFeedback | undefined =
      (trackPain && painLevel != null) || (trackMood && moodLevel != null) || trimmedNote
        ? {
            ...(trackPain && painLevel != null ? { painLevel } : {}),
            ...(trackMood && moodLevel != null ? { moodLevel } : {}),
            ...(trimmedNote ? { note: trimmedNote } : {}),
          }
        : undefined;
    onSave({ time, feedback });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {contextLabel && <p className="text-sm text-brand-text-muted">{contextLabel}</p>}

      <Field label="Actual time taken">
        <input
          type="time"
          required
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className={inputClass}
        />
      </Field>

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

      <Field label="Notes (optional)">
        <textarea
          className={inputClass}
          rows={2}
          maxLength={255}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      <DialogFooter className={onBack ? "justify-between" : undefined}>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-brand-deep-blue hover:underline"
          >
            ← Back
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Logging…" : "Log dose"}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
