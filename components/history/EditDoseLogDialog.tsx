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
import { Field, inputClass } from "@/components/ui/Field";
import { LevelGrid } from "@/components/ui/LevelGrid";
import { deleteDoseLog, editDoseLog } from "@/lib/dose-logs";
import { medicationTracksMood, medicationTracksPain } from "@/lib/pain-mood";
import { localDateString } from "@/lib/utils";
import type { DoseLogStatus, Medication } from "@/lib/types/medications";

export interface EditableDoseLog {
  id: string;
  status: DoseLogStatus;
  scheduledForDate: string; // "YYYY-MM-DD" — the date this dose was scheduled for
  takenAt: string | null;
  painLevel: number | null;
  moodLevel: number | null;
  note: string;
  // The exact amount actually deducted for this entry (from
  // dose_logs.deducted_quantity) — may differ from the medication's
  // default quantity_per_dose when the slot had a group or per-
  // schedule-time override. Needed so re-saving a "taken" entry
  // without changing its amount doesn't silently shift inventory.
  deductedQuantity: number | null;
}

interface EditDoseLogDialogProps {
  log: EditableDoseLog | null;
  medication: Medication | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

export function EditDoseLogDialog({
  log,
  medication,
  onClose,
  onSaved,
  onDeleted,
}: EditDoseLogDialogProps) {
  return (
    <Dialog open={log !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {log && medication && (
          <EditDoseLogForm
            key={log.id}
            log={log}
            medication={medication}
            onSaved={onSaved}
            onDeleted={onDeleted}
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

const STATUS_OPTIONS: { value: DoseLogStatus; label: string }[] = [
  { value: "taken", label: "Taken" },
  { value: "skipped", label: "Skipped" },
  { value: "missed", label: "Missed" },
];

function timeFromIso(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface EditDoseLogFormProps {
  log: EditableDoseLog;
  medication: Medication;
  onSaved: () => void;
  onDeleted: () => void;
  onCancel: () => void;
}

function EditDoseLogForm({ log, medication, onSaved, onDeleted, onCancel }: EditDoseLogFormProps) {
  const [status, setStatus] = useState<DoseLogStatus>(log.status);
  const [time, setTime] = useState(() => timeFromIso(log.takenAt) ?? nowTime());
  const [painLevel, setPainLevel] = useState<number | null>(log.painLevel);
  const [moodLevel, setMoodLevel] = useState<number | null>(log.moodLevel);
  const [note, setNote] = useState(log.note);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trackPain = medicationTracksPain(medication);
  const trackMood = medicationTracksMood(medication);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // Local calendar date, not the UTC slice takenAt's ISO string
      // would give — timeFromIso already displays the local time, so
      // the date it's combined with here has to match in the same
      // local frame or the reconstructed timestamp silently drifts a
      // day for anyone not on UTC.
      const baseDate = log.takenAt
        ? localDateString(new Date(log.takenAt))
        : log.scheduledForDate;
      // Was already 'taken' and staying 'taken' (editing the note/
      // time/levels only): reuse the exact amount originally deducted
      // for this slot, which may differ from the medication's default
      // quantity_per_dose (a group or per-schedule-time override) —
      // otherwise the RPC's restore-then-deduct cycle would silently
      // shift inventory by the difference even though nothing about
      // the dose amount changed. A transition INTO 'taken' from
      // skipped/missed has no original amount to preserve, so it
      // falls back to the medication default.
      const quantityPerDose =
        status === "taken" && log.status === "taken" && log.deductedQuantity !== null
          ? log.deductedQuantity
          : medication.quantity_per_dose;
      await editDoseLog(log.id, {
        status,
        takenAt: status === "taken" ? new Date(`${baseDate}T${time}:00`).toISOString() : null,
        painLevel: status === "taken" && trackPain ? (painLevel ?? undefined) : undefined,
        moodLevel: status === "taken" && trackMood ? (moodLevel ?? undefined) : undefined,
        note: status === "taken" ? note.trim() : "",
        quantityPerDose,
        inventoryEnabled: medication.inventory_enabled,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save changes");
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteDoseLog(log.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete this entry");
      setDeleting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit dose entry</DialogTitle>
        <p className="text-sm text-brand-text-muted">{medication.name}</p>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <Field label="Status">
          <select
            className={inputClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as DoseLogStatus)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        {status === "taken" && (
          <Field label="Time taken">
            <input
              type="time"
              className={inputClass}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>
        )}

        {status === "taken" && trackPain && (
          <LevelGrid
            value={painLevel}
            onChange={setPainLevel}
            label="Pain level"
            hint="(1 = minimal — 10 = severe)"
          />
        )}
        {status === "taken" && trackMood && (
          <LevelGrid
            value={moodLevel}
            onChange={setMoodLevel}
            label="Mood level"
            hint="(1 = very low — 10 = excellent)"
          />
        )}

        {status === "taken" && (
          <Field label="Notes (optional)">
            <textarea
              className={inputClass}
              rows={2}
              maxLength={255}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        )}

        {error && <p className="text-sm text-status-danger">{error}</p>}
      </div>

      {confirmingDelete ? (
        <DialogFooter className="items-center justify-between">
          <span className="text-sm text-brand-text-muted">Delete this entry?</span>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(false)}>
              Keep entry
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="border-status-danger text-status-danger hover:bg-status-danger/10"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Confirm delete"}
            </Button>
          </div>
        </DialogFooter>
      ) : (
        <DialogFooter className="justify-between">
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="text-sm text-status-danger hover:underline"
          >
            Delete
          </button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      )}
    </>
  );
}
