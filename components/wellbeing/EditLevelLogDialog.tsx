"use client";

import { useState, type ReactNode } from "react";
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
import { deleteStandaloneLog, updateStandaloneLog, type WellbeingMetric } from "@/lib/pain-mood";
import type { Medication } from "@/lib/types/medications";

// A standalone pain/mood log entry in the shape the edit form needs —
// carved out of the merged TrendPoint (which drops medication_id/tags
// detail dose-linked entries don't have) rather than reusing
// StandalonePainMoodLog directly, since callers build it straight from a
// TrendPoint plus the medication id already fixed by the history query.
export interface EditableLevelLog {
  id: string;
  level: number;
  medicationId: string | null;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  note: string;
  tags: string[];
}

const INDEPENDENT = "independent";

interface EditLevelLogDialogProps {
  log: EditableLevelLog | null;
  metric: WellbeingMetric;
  medications: Medication[];
  renderTagPicker?: (selected: string[], onChange: (tags: string[]) => void) => ReactNode;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

// Sibling of EditDoseLogDialog for standalone pain/mood entries — same
// shape (status/level fields, a "Delete" text-button that reveals a
// confirm step, Cancel/Save footer), reusing LogLevelModal's field set
// (medication link, LevelGrid, date/time, tags, note) in edit mode.
export function EditLevelLogDialog({
  log,
  metric,
  medications,
  renderTagPicker,
  onClose,
  onSaved,
  onDeleted,
}: EditLevelLogDialogProps) {
  return (
    <Dialog open={log !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {log && (
          <EditLevelLogForm
            key={log.id}
            log={log}
            metric={metric}
            medications={medications}
            renderTagPicker={renderTagPicker}
            onSaved={onSaved}
            onDeleted={onDeleted}
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface EditLevelLogFormProps {
  log: EditableLevelLog;
  metric: WellbeingMetric;
  medications: Medication[];
  renderTagPicker?: (selected: string[], onChange: (tags: string[]) => void) => ReactNode;
  onSaved: () => void;
  onDeleted: () => void;
  onCancel: () => void;
}

function EditLevelLogForm({
  log,
  metric,
  medications,
  renderTagPicker,
  onSaved,
  onDeleted,
  onCancel,
}: EditLevelLogFormProps) {
  const [level, setLevel] = useState<number | null>(log.level);
  const [medicationId, setMedicationId] = useState(log.medicationId ?? INDEPENDENT);
  const [date, setDate] = useState(log.date);
  const [time, setTime] = useState(log.time);
  const [note, setNote] = useState(log.note);
  const [tags, setTags] = useState<string[]>(log.tags);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metricLabel = metric === "pain" ? "Pain" : "Mood";
  const hint =
    metric === "pain" ? "(1 = minimal — 10 = severe)" : "(1 = very low — 10 = excellent)";

  async function handleSave() {
    if (level === null) return;
    setSaving(true);
    setError(null);
    try {
      await updateStandaloneLog(log.id, {
        medicationId: medicationId === INDEPENDENT ? null : medicationId,
        painLevel: metric === "pain" ? level : null,
        moodLevel: metric === "mood" ? level : null,
        note: note.trim(),
        tags: tags.join(","),
        loggedAt: `${date}T${time}:00`,
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
      await deleteStandaloneLog(log.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete this entry");
      setDeleting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit {metricLabel.toLowerCase()} log</DialogTitle>
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
            <Button type="button" onClick={handleSave} disabled={saving || level === null}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      )}
    </>
  );
}
