"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUpDown } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { getDoseLogHistory, type CalendarLogRow } from "@/lib/dose-logs";
import { getInactiveMedications } from "@/lib/medications";
import { getMissedGraceMinutes } from "@/lib/app-settings";
import { formatLate, isLate, minutesLate, to12h } from "@/lib/utils";
import type { Medication } from "@/lib/types/medications";
import { EditDoseLogDialog, type EditableDoseLog } from "@/components/history/EditDoseLogDialog";

const COLLAPSED_COUNT = 4;

function badgeVariantFor(row: CalendarLogRow, graceMinutes: number): BadgeVariant {
  if (row.status === "taken") return isLate(row, graceMinutes) ? "late" : "taken";
  return row.status;
}

export function TodayHistoryPanel({
  date,
  medications,
}: {
  date: string;
  /** The active profile's currently-active medications; inactive ones are fetched here so a med discontinued later the same day it was logged still shows. */
  medications: Medication[];
}) {
  const queryClient = useQueryClient();
  const { activeProfileId } = useActiveProfile();
  const [newestFirst, setNewestFirst] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<{ log: EditableDoseLog; medication: Medication } | null>(
    null,
  );

  const inactiveMedicationsQuery = useQuery({
    queryKey: ["medications", "inactive", activeProfileId],
    queryFn: () => getInactiveMedications(activeProfileId),
  });
  const allMedications = useMemo(
    () => [...medications, ...(inactiveMedicationsQuery.data ?? [])],
    [medications, inactiveMedicationsQuery.data],
  );

  const medicationIds = useMemo(() => allMedications.map((m) => m.id), [allMedications]);
  const graceQuery = useQuery({
    queryKey: ["app-settings", "missed_grace_minutes"],
    queryFn: getMissedGraceMinutes,
  });
  const graceMinutes = graceQuery.data ?? 60;

  const logsQuery = useQuery({
    queryKey: ["today-history", date, medicationIds],
    queryFn: () =>
      getDoseLogHistory({ medicationIds, startDate: date, endDate: date, limit: 100 }),
    enabled: medicationIds.length > 0,
  });

  const entries = useMemo(() => {
    const rows = logsQuery.data ?? [];
    return newestFirst ? rows : [...rows].reverse();
  }, [logsQuery.data, newestFirst]);

  const visible = showAll ? entries : entries.slice(0, COLLAPSED_COUNT);

  function handleEdit(row: CalendarLogRow) {
    const medication = allMedications.find((m) => m.id === row.medication_id);
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

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["today-history"] });
    queryClient.invalidateQueries({ queryKey: ["dose-logs"] });
  }

  return (
    <div className="rounded-card border border-brand-border bg-brand-card p-4 shadow-card sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-bold text-brand-navy">Today&apos;s history</h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setNewestFirst((v) => !v)}
            aria-label="Toggle sort order"
            title={newestFirst ? "Newest first" : "Oldest first"}
            className="text-brand-text-muted hover:text-brand-text"
          >
            <ArrowUpDown size={16} />
          </button>
          <Link href="/history" className="text-sm font-medium text-brand-deep-blue hover:underline">
            View all history
          </Link>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-brand-text-muted">No doses logged today yet.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {visible.map((row) => {
            const lateMin = row.status === "taken" ? minutesLate(row, graceMinutes) : null;
            const medication = allMedications.find((m) => m.id === row.medication_id);
            const isSystemNote = row.note.startsWith("Auto-");
            return (
              <li
                key={row.id}
                className="flex items-start justify-between gap-3 rounded-control border border-brand-border p-3"
              >
                <div className="flex min-w-0 flex-1 gap-3">
                  <span className="w-16 shrink-0 pt-0.5 text-xs text-brand-text-muted">
                    {to12h(row.scheduled_time.slice(0, 5))}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-brand-text">{row.medications.name}</span>
                      {row.medications.dose && (
                        <span className="text-sm text-brand-text-muted">{row.medications.dose}</span>
                      )}
                    </div>
                    {(row.pain_level !== null || row.mood_level !== null) && (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {row.pain_level !== null && <ScoreBadge type="pain" level={row.pain_level} />}
                        {row.mood_level !== null && <ScoreBadge type="mood" level={row.mood_level} />}
                      </div>
                    )}
                    {row.note && !isSystemNote && (
                      <p className="mt-1 text-sm text-brand-text-muted">{row.note}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Badge variant={badgeVariantFor(row, graceMinutes)}>
                    {row.status === "taken" && lateMin !== null
                      ? `Taken (${formatLate(lateMin)})`
                      : undefined}
                  </Badge>
                  {medication?.active && (
                    <button
                      type="button"
                      onClick={() => handleEdit(row)}
                      className="text-xs text-brand-deep-blue hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {!showAll && entries.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 w-full rounded-control border border-brand-border py-2 text-sm font-medium text-brand-navy hover:bg-brand-bg"
        >
          View more
        </button>
      )}

      <EditDoseLogDialog
        log={editing?.log ?? null}
        medication={editing?.medication ?? null}
        onClose={() => setEditing(null)}
        onSaved={() => {
          toast.success("Dose entry updated");
          setEditing(null);
          refresh();
        }}
        onDeleted={() => {
          toast.success("Dose entry deleted");
          setEditing(null);
          refresh();
        }}
      />
    </div>
  );
}
