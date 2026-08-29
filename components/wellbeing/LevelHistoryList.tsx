"use client";

import { useState, type ReactNode } from "react";
import { to12h } from "@/lib/utils";
import { levelColor, type TrendPoint, type WellbeingMetric } from "@/lib/pain-mood";
import { EditLevelLogDialog, type EditableLevelLog } from "./EditLevelLogDialog";
import type { Medication } from "@/lib/types/medications";

interface LevelHistoryListProps {
  metric: WellbeingMetric;
  points: TrendPoint[];
  // The medication (or null for "Independent") the history query is
  // currently scoped to — every standalone point in `points` shares this
  // medication_id, so it doubles as the edit form's initial selection.
  medicationId: string | null;
  medications: Medication[];
  renderTagPicker?: (selected: string[], onChange: (tags: string[]) => void) => ReactNode;
  onSaved: () => void;
  onDeleted: () => void;
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

  if (points.length === 0) {
    return (
      <p className="text-sm text-brand-text-muted">
        No {metric} levels recorded for this medication yet.
      </p>
    );
  }

  return (
    <>
      <ol className="flex flex-col gap-2">
        {points.map((point) => (
          <li
            key={point.id}
            className="flex items-start gap-3 rounded-card border border-brand-border bg-brand-card p-3"
          >
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: levelColor(metric, point.level) }}
            >
              {point.level}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm text-brand-text">
                <span className="font-medium">
                  {point.date} · {to12h(point.time)}
                </span>
                <span className="text-xs text-brand-text-muted">
                  {point.source === "dose" ? "Logged with dose" : "Standalone entry"}
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
              {point.note && <p className="mt-1 text-sm text-brand-text-muted">{point.note}</p>}
            </div>
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
                className="shrink-0 self-start text-xs text-brand-deep-blue hover:underline"
              >
                Edit
              </button>
            )}
          </li>
        ))}
      </ol>

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
