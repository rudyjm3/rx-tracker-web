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
import { editDoseLogsBatch, recordDose, recordDoseAtTime } from "@/lib/dose-logs";
import { localDateString } from "@/lib/utils";
import type { DoseLogStatus, Medication } from "@/lib/types/medications";

// One dose_logs row belonging to a group's shared dose for a given day —
// enough to both display the member and re-apply a bulk edit to it via
// the same edit_dose_log logic the single-slot EditDoseLogDialog uses
// (via the atomic edit_dose_logs_batch RPC).
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

// A group member (in practice an as-needed one, which is never auto-
// finalized) with no dose_logs row for this group dose yet. Saving the
// bulk edit creates its row at the group's slot time so the whole group
// ends up with one consistent status/time instead of leaving the
// supplement behind to be logged separately.
export interface BulkPendingMember {
  medication: Medication;
  scheduledForDate: string;
  scheduledTime: string; // "HH:MM" — the group's slot time that day
  quantityPerDose: number;
}

interface BulkEditDoseLogDialogProps {
  groupName: string | null; // null closes the dialog
  logs: BulkEditableDoseLog[];
  pending?: BulkPendingMember[];
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
 * dose, in one dialog. Existing rows are edited through a single atomic
 * edit_dose_logs_batch RPC (all or none). Members with no row yet
 * (`pending`) are still created by separate record_dose calls, so those
 * are not covered by that atomicity. Each member's own per-slot Edit
 * action (EditDoseLogDialog) stays fully available and untouched.
 */
export function BulkEditDoseLogDialog({
  groupName,
  logs,
  pending = [],
  onClose,
  onSaved,
}: BulkEditDoseLogDialogProps) {
  const open = groupName !== null && logs.length + pending.length > 0;
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        {open && (
          <>
            <DialogHeader>
              <DialogTitle>Edit all — {groupName}</DialogTitle>
              <p className="text-sm text-brand-text-muted">
                Applies to all {logs.length + pending.length} medications in this group for this dose.
              </p>
            </DialogHeader>
            <BulkEditDoseLogForm
              key={[...logs.map((l) => l.logId), ...pending.map((p) => p.medication.id)].join(",")}
              logs={logs}
              pending={pending}
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
  pending,
  onSaved,
  onCancel,
}: {
  logs: BulkEditableDoseLog[];
  pending: BulkPendingMember[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  // Seeded from the first member — every member is about to be
  // overwritten with the same status/time/note, so there's no single
  // "correct" starting value to read back when members currently differ.
  const first = logs[0];
  const [status, setStatus] = useState<DoseLogStatus>(first?.status ?? "taken");
  const [time, setTime] = useState(() => timeFromIso(first?.takenAt ?? null) ?? nowTime());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // Existing rows first, as one transaction: if it fails nothing has
      // been written yet and the pending members below are never touched.
      await editDoseLogsBatch(
        logs.map((log) => {
          const baseDate = log.takenAt
            ? localDateString(new Date(log.takenAt))
            : log.scheduledForDate;
          const quantityPerDose =
            status === "taken" && log.status === "taken" && log.deductedQuantity !== null
              ? log.deductedQuantity
              : log.quantityPerDose;
          return {
            logId: log.logId,
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
          };
        }),
      );
      await Promise.all(
        pending.map((member) => {
          // "Missed" isn't a state an unlogged as-needed member can be
          // in (it was never due), so it's left unlogged in that case.
          if (status === "missed") return Promise.resolve();
          if (status === "skipped") {
            return recordDose(
              member.medication,
              member.scheduledForDate,
              member.scheduledTime,
              "skipped",
              member.quantityPerDose,
            );
          }
          return recordDoseAtTime(
            member.medication,
            member.scheduledForDate,
            member.scheduledTime,
            new Date(`${member.scheduledForDate}T${time}:00`).toISOString(),
            member.quantityPerDose,
            note.trim() ? { note: note.trim() } : undefined,
          );
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
          {pending.map((p) => (
            <li key={p.medication.id}>
              {p.medication.name} (not yet logged
              {status === "missed" ? " — left unlogged" : ""})
            </li>
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
