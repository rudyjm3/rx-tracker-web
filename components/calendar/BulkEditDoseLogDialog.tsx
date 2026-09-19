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
import { editDoseLog } from "@/lib/dose-logs";
import { localDateString } from "@/lib/utils";
import type { DoseLogStatus } from "@/lib/types/medications";

// One dose_logs row belonging to a group's shared dose for a given day —
// enough to both display the member and re-apply a bulk edit to it via
// the same editDoseLog RPC the single-slot EditDoseLogDialog uses.
export interface BulkEditableDoseLog {
  logId: string;
  medicationId: string;
  medicationName: string;
  status: DoseLogStatus;
  scheduledForDate: string;
  takenAt: string | null;
  painLevel: number | null;
  moodLevel: number | null;
  deductedQuantity: number | null;
  quantityPerDose: number;
  inventoryEnabled: boolean;
}

interface BulkEditDoseLogDialogProps {
  groupName: string | null; // null closes the dialog
  logs: BulkEditableDoseLog[];
  onClose: () => void;
  onSaved: () => void;
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

/**
 * Group-level counterpart to EditDoseLogDialog: applies the same status/
 * time-taken/note to every member's dose_logs row for a shared group
 * dose, in one dialog — matching this codebase's existing "bulk = N
 * individual calls" precedent (e.g. DashboardClient's handleTakeAll)
 * rather than a new Postgres RPC. Each member's own per-slot Edit action
 * (EditDoseLogDialog) stays fully available and untouched by this.
 */
export function BulkEditDoseLogDialog({
  groupName,
  logs,
  onClose,
  onSaved,
}: BulkEditDoseLogDialogProps) {
  const open = groupName !== null && logs.length > 0;
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        {open && (
          <>
            <DialogHeader>
              <DialogTitle>Edit all — {groupName}</DialogTitle>
              <p className="text-sm text-brand-text-muted">
                Applies to all {logs.length} medications in this group for this dose.
              </p>
            </DialogHeader>
            <BulkEditDoseLogForm
              key={logs.map((l) => l.logId).join(",")}
              logs={logs}
              onSaved={onSaved}
              onCancel={onClose}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BulkEditDoseLogForm({
  logs,
  onSaved,
  onCancel,
}: {
  logs: BulkEditableDoseLog[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  // Seeded from the first member — every member is about to be
  // overwritten with the same status/time/note, so there's no single
  // "correct" starting value to read back when members currently differ.
  const first = logs[0];
  const [status, setStatus] = useState<DoseLogStatus>(first.status);
  const [time, setTime] = useState(() => timeFromIso(first.takenAt) ?? nowTime());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await Promise.all(
        logs.map((log) => {
          const baseDate = log.takenAt
            ? localDateString(new Date(log.takenAt))
            : log.scheduledForDate;
          const quantityPerDose =
            status === "taken" && log.status === "taken" && log.deductedQuantity !== null
              ? log.deductedQuantity
              : log.quantityPerDose;
          return editDoseLog(log.logId, {
            status,
            takenAt: status === "taken" ? new Date(`${baseDate}T${time}:00`).toISOString() : null,
            // Each member's own pain/mood feedback is preserved as-is
            // (not user-editable here) rather than blanked out — the
            // edit_dose_log RPC always writes whatever's passed for a
            // 'taken' row, so omitting these would silently wipe
            // feedback that has nothing to do with this bulk status/time
            // change.
            painLevel: status === "taken" ? (log.painLevel ?? undefined) : undefined,
            moodLevel: status === "taken" ? (log.moodLevel ?? undefined) : undefined,
            note: status === "taken" ? note.trim() : "",
            quantityPerDose,
            inventoryEnabled: log.inventoryEnabled,
          });
        }),
      );
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save changes");
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <Field label="Status (applies to all)">
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

        {status === "taken" && (
          <Field label="Notes (optional, applies to all)">
            <textarea
              className={inputClass}
              rows={2}
              maxLength={255}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        )}

        <ul className="flex flex-col gap-1 text-xs text-brand-text-muted">
          {logs.map((l) => (
            <li key={l.logId}>{l.medicationName}</li>
          ))}
        </ul>

        {error && <p className="text-sm text-status-danger">{error}</p>}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save all"}
        </Button>
      </DialogFooter>
    </>
  );
}
