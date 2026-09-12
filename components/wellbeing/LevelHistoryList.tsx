"use client";

import { useState, type ReactNode } from "react";
import { MedicationNameWithDose } from "@/components/ui/MedicationNameWithDose";
import { levelColor, type TrendPoint, type WellbeingMetric } from "@/lib/pain-mood";
import { to12h } from "@/lib/utils";
import { EditLevelLogDialog, type EditableLevelLog } from "./EditLevelLogDialog";
import type { Medication } from "@/lib/types/medications";

const COLLAPSED_COUNT = 5;

interface LevelHistoryListProps {
  metric: WellbeingMetric;
  points: TrendPoint[];
  medicationId: string | null;
  medications: Medication[];
  renderTagPicker?: (selected: string[], onChange: (tags: string[]) => void) => ReactNode;
  onSaved: () => void;
  onDeleted: () => void;
}

function formatHistoryDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatEditedAt(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LevelHistoryList({
  metric,
  points,
  medicationId,
  medications,
  renderTagPicker,
  onSaved,
  onDeleted,
}: LevelHistoryListProps) {
  const [editing, setEditing] = useState<EditableLevelLog | null>(null);
  const [showAll, setShowAll] = useState(true);
  const selectedMedication = medicationId
    ? medications.find((med) => med.id === medicationId) ?? null
    : null;
  const metricLabel = metric === "pain" ? "Pain" : "Mood";
  const visiblePoints = showAll ? points : points.slice(0, COLLAPSED_COUNT);
  const canCollapse = points.length > COLLAPSED_COUNT;

  if (points.length === 0) {
    return (
      <p className="text-sm text-brand-text-muted">
        No {metric} levels recorded for this medication yet.
      </p>
    );
  }

  return (
    <>
      <div className="rounded-card border border-brand-border bg-brand-card p-4 shadow-card sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-bold text-brand-navy">{metricLabel} log history</h3>
          {canCollapse && showAll && (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="text-sm font-semibold text-brand-deep-blue hover:underline"
            >
              View less
            </button>
          )}
        </div>

        <ol className="divide-y divide-brand-border">
          {visiblePoints.map((point) => {
            const scoreColor = levelColor(metric, point.level);
            return (
              <li key={point.id} className="grid grid-cols-[86px_1fr_auto] gap-4 py-3">
                <div className="pt-0.5">
                  <p className="text-xs font-semibold text-brand-text-muted">
                    {formatHistoryDate(point.date)}
                  </p>
                  <p className="mt-1 font-bold text-brand-navy">{to12h(point.time)}</p>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {point.source === "dose" && selectedMedication ? (
                      <MedicationNameWithDose
                        medication={selectedMedication}
                        className="font-bold text-brand-text"
                        doseClassName="text-sm font-bold text-brand-text-muted"
                      />
                    ) : (
                      <span className="rounded-full bg-brand-bg px-2 py-0.5 text-xs font-bold uppercase text-brand-deep-blue">
                        Standalone
                      </span>
                    )}
                    {point.source === "dose" && (
                      <span className="rounded-full bg-brand-bg px-2 py-0.5 text-xs font-bold uppercase text-brand-text-muted">
                        Dose log entry
                      </span>
                    )}
                    <span className="text-xs font-semibold text-brand-text-muted">
                      {metricLabel} Score
                    </span>
                    <span
                      className="rounded-full border bg-white px-2 py-0.5 text-xs font-bold"
                      style={{ borderColor: scoreColor, color: scoreColor }}
                    >
                      {point.level}/10
                    </span>
                  </div>

                  {point.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {point.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-brand-bg px-2 py-0.5 text-xs text-brand-text-muted"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {point.note && (
                    <p className="mt-1 text-sm text-brand-text-muted">
                      <span className="font-semibold">Comments:</span>{" "}
                      <span className="italic">{point.note}</span>
                    </p>
                  )}

                  {point.editedAt && (
                    <p className="mt-1 text-xs italic text-brand-text-muted">
                      Last edited {formatEditedAt(point.editedAt)}
                    </p>
                  )}
                </div>

                <div className="pt-1">
                  {point.source === "standalone" && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({
                          id: point.id,
                          level: point.level,
                          medicationId,
                          date: point.date,
                          time: point.time,
                          note: point.note,
                          tags: point.tags,
                        })
                      }
                      className="rounded-control border border-brand-border px-3 py-1 text-xs font-semibold text-brand-text-muted hover:bg-brand-bg"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {canCollapse && (
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="mt-4 w-full text-center text-base font-semibold text-brand-deep-blue hover:underline"
          >
            {showAll ? "View less" : "View more"}
          </button>
        )}
      </div>

      <EditLevelLogDialog
        log={editing}
        metric={metric}
        medications={medications}
        renderTagPicker={renderTagPicker}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          onSaved();
        }}
        onDeleted={() => {
          setEditing(null);
          onDeleted();
        }}
      />
    </>
  );
}
