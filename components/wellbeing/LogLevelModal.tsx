"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { Field, inputClass } from "@/components/ui/Field";
import { LevelGrid } from "@/components/ui/LevelGrid";
import { localDateString } from "@/lib/utils";
import type { WellbeingMetric } from "@/lib/pain-mood";
import type { Medication } from "@/lib/types/medications";

export interface LogLevelSubmitInput {
  level: number;
  medicationId: string | null;
  loggedAt: string; // ISO, local date+time
  note: string;
  tags: string[];
}

interface LogLevelModalProps {
  metric: WellbeingMetric;
  medications: Medication[];
  onSubmit: (input: LogLevelSubmitInput) => void;
  renderTagPicker?: (selected: string[], onChange: (tags: string[]) => void) => ReactNode;
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const INDEPENDENT = "independent";

export function LogLevelModal({
  metric,
  medications,
  onSubmit,
  renderTagPicker,
}: LogLevelModalProps) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<number | null>(null);
  const [medicationId, setMedicationId] = useState<string>(INDEPENDENT);
  const [date, setDate] = useState(localDateString);
  const [time, setTime] = useState(nowTime);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [showComment, setShowComment] = useState(false);

  function reset() {
    setLevel(null);
    setMedicationId(INDEPENDENT);
    setDate(localDateString());
    setTime(nowTime());
    setNote("");
    setTags([]);
    setShowComment(false);
  }

  function handleSubmit() {
    if (level === null) return;
    onSubmit({
      level,
      medicationId: medicationId === INDEPENDENT ? null : medicationId,
      loggedAt: `${date}T${time}:00`,
      note: note.trim(),
      tags,
    });
    reset();
    setOpen(false);
  }

  const metricLabel = metric === "pain" ? "Pain" : "Mood";
  const hint =
    metric === "pain" ? "(1 = minimal — 10 = severe)" : "(1 = very low — 10 = excellent)";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="w-full rounded-card border border-brand-border bg-brand-card p-4 text-left shadow-card"
        >
          <p className="text-sm text-brand-text-muted">
            Use this to record a {metric} level any time you want to log how you&apos;re feeling,
            separate from a scheduled dose.
          </p>
          <span className="mt-2 inline-block rounded-control bg-gradient-brand px-4 py-2 text-sm font-semibold text-white">
            Log {metric} level now
          </span>
        </button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log {metricLabel.toLowerCase()} level</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {medications.length > 0 && (
            <Field label="Link to a medication (optional)">
              <select
                className={inputClass}
                value={medicationId}
                onChange={(e) => setMedicationId(e.target.value)}
              >
                <option value={INDEPENDENT}>No medication — log independently</option>
                {medications.map((med) => (
                  <option key={med.id} value={med.id}>
                    {med.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <LevelGrid value={level} onChange={setLevel} label={`${metricLabel} level`} hint={hint} />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input
                type="date"
                className={inputClass}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Time">
              <input
                type="time"
                className={inputClass}
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </Field>
          </div>

          {renderTagPicker && (
            <div>
              <p className="text-sm font-medium text-brand-text">
                Tags <span className="text-xs font-normal text-brand-text-muted">(optional)</span>
              </p>
              <div className="mt-2">{renderTagPicker(tags, setTags)}</div>
            </div>
          )}

          {showComment ? (
            <Field label="Comments (optional)">
              <textarea
                className={inputClass}
                rows={2}
                maxLength={255}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Any notes about this level…"
              />
            </Field>
          ) : (
            <button
              type="button"
              onClick={() => setShowComment(true)}
              className="self-start text-sm text-brand-deep-blue hover:underline"
            >
              + Add comment
            </button>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={level === null}>
            Save log
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
