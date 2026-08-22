"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { getDoseLogHistory, type CalendarLogRow } from "@/lib/dose-logs";
import { getActiveMedications, getInactiveMedications } from "@/lib/medications";
import { getMissedGraceMinutes } from "@/lib/app-settings";
import { formatLate, isLate, localDateString, minutesLate, to12h } from "@/lib/utils";
import type { Medication } from "@/lib/types/medications";
import { EditDoseLogDialog, type EditableDoseLog } from "./EditDoseLogDialog";

const PAGE_SIZE = 25;
const ALL_MEDICATIONS = "all";

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return localDateString(d);
}

function badgeVariantFor(row: CalendarLogRow, graceMinutes: number): BadgeVariant {
  if (row.status === "taken") {
    return isLate(row, graceMinutes) ? "late" : "taken";
  }
  return row.status;
}

export function HistoryClient() {
  const [selectedMedicationId, setSelectedMedicationId] = useState<string>(ALL_MEDICATIONS);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(localDateString);

  const activeMedicationsQuery = useQuery({
    queryKey: ["medications", "active"],
    queryFn: getActiveMedications,
  });
  const inactiveMedicationsQuery = useQuery({
    queryKey: ["medications", "inactive"],
    queryFn: getInactiveMedications,
  });
  const allMedications = useMemo(
    () => [...(activeMedicationsQuery.data ?? []), ...(inactiveMedicationsQuery.data ?? [])],
    [activeMedicationsQuery.data, inactiveMedicationsQuery.data],
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-brand-navy">History</h1>

      <div className="flex flex-wrap gap-3">
        <Field label="Medication">
          <select
            className={inputClass}
            value={selectedMedicationId}
            onChange={(e) => setSelectedMedicationId(e.target.value)}
          >
            <option value={ALL_MEDICATIONS}>All medications</option>
            {allMedications.map((med) => (
              <option key={med.id} value={med.id}>
                {med.name}
                {!med.active ? " (inactive)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <input
            type="date"
            className={inputClass}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Field label="To">
          <input
            type="date"
            className={inputClass}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </Field>
      </div>

      <HistoryList
        key={`${selectedMedicationId}|${startDate}|${endDate}`}
        medicationId={selectedMedicationId === ALL_MEDICATIONS ? undefined : selectedMedicationId}
        startDate={startDate}
        endDate={endDate}
        medications={allMedications}
      />
    </div>
  );
}

interface HistoryListProps {
  medicationId: string | undefined;
  startDate: string;
  endDate: string;
  medications: Medication[];
}

function HistoryList({ medicationId, startDate, endDate, medications }: HistoryListProps) {
  const queryClient = useQueryClient();
  // "Load more" grows this and re-fetches from offset 0 up to the new
  // limit, rather than accumulating separately-fetched pages client
  // side — simpler (the query's data *is* the full visible list, no
  // effect/setState needed to merge pages) at the cost of re-fetching
  // already-seen rows on each click, an acceptable trade for this
  // app's realistic history sizes.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [editing, setEditing] = useState<{ log: EditableDoseLog; medication: Medication } | null>(
    null,
  );

  const graceQuery = useQuery({
    queryKey: ["app-settings", "missed_grace_minutes"],
    queryFn: getMissedGraceMinutes,
  });
  const graceMinutes = graceQuery.data ?? 60;

  const pageQuery = useQuery({
    queryKey: ["dose-log-history", medicationId ?? ALL_MEDICATIONS, startDate, endDate, visibleCount],
    queryFn: () =>
      getDoseLogHistory({ medicationId, startDate, endDate, limit: visibleCount, offset: 0 }),
  });

  const entries = pageQuery.data ?? [];
  const hasMore = entries.length === visibleCount;

  function refreshFromStart() {
    queryClient.invalidateQueries({ queryKey: ["dose-log-history"] });
  }

  function handleEdit(row: CalendarLogRow) {
    const medication = medications.find((m) => m.id === row.medication_id);
    if (!medication) return;
    setEditing({
      medication,
      log: {
        id: row.id,
        status: row.status,
        scheduledForDate: row.scheduled_for_date,
        takenAt: row.taken_at,
        painLevel: row.pain_level,
        moodLevel: row.mood_level,
        note: row.note,
        deductedQuantity: row.deducted_quantity,
      },
    });
  }

  const isInitialLoading = pageQuery.isLoading && entries.length === 0;

  return (
    <div className="flex flex-col gap-3">
      {isInitialLoading ? (
        <p className="text-sm text-brand-text-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-brand-text-muted">No dose history for this filter.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {entries.map((row) => {
            const lateMin = row.status === "taken" ? minutesLate(row, graceMinutes) : null;
            return (
              <li
                key={row.id}
                className="flex items-start justify-between gap-3 rounded-card border border-brand-border bg-brand-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-brand-text">{row.medications.name}</span>
                    {row.medications.dose && (
                      <span className="text-sm text-brand-text-muted">{row.medications.dose}</span>
                    )}
                  </div>
                  <p className="text-sm text-brand-text-muted">
                    {row.scheduled_for_date} · {to12h(row.scheduled_time.slice(0, 5))}
                  </p>
                  {(row.pain_level !== null || row.mood_level !== null) && (
                    <p className="mt-1 text-xs text-brand-text-muted">
                      {row.pain_level !== null && <>Pain {row.pain_level}/10 </>}
                      {row.mood_level !== null && <>Mood {row.mood_level}/10</>}
                    </p>
                  )}
                  {row.note && <p className="mt-1 text-sm text-brand-text-muted">{row.note}</p>}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge variant={badgeVariantFor(row, graceMinutes)}>
                    {row.status === "taken" && lateMin !== null
                      ? `Taken (${formatLate(lateMin)})`
                      : undefined}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => handleEdit(row)}
                    className="text-xs text-brand-deep-blue hover:underline"
                  >
                    Edit
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {hasMore && entries.length > 0 && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
          disabled={pageQuery.isFetching}
        >
          {pageQuery.isFetching ? "Loading…" : "Load more"}
        </Button>
      )}

      <EditDoseLogDialog
        log={editing?.log ?? null}
        medication={editing?.medication ?? null}
        onClose={() => setEditing(null)}
        onSaved={() => {
          toast.success("Dose entry updated");
          setEditing(null);
          refreshFromStart();
        }}
        onDeleted={() => {
          toast.success("Dose entry deleted");
          setEditing(null);
          refreshFromStart();
        }}
      />
    </div>
  );
}
