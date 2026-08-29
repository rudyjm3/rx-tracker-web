"use client";

import { useQuery } from "@tanstack/react-query";
import { getDoseHistory } from "@/lib/medications";

export function DoseHistoryPanel({ medicationId }: { medicationId: string }) {
  const { data: entries, isLoading } = useQuery({
    queryKey: ["dose-history", medicationId],
    queryFn: () => getDoseHistory(medicationId),
  });

  if (isLoading) {
    return <p className="text-xs text-brand-text-muted">Loading history…</p>;
  }

  if (!entries || entries.length === 0) {
    return <p className="text-xs text-brand-text-muted">No history yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li key={`${entry.type}-${entry.data.id}`} className="text-xs text-brand-text">
          <span className="text-brand-text-muted">
            {new Date(entry.at).toLocaleDateString()} —{" "}
          </span>
          {entry.type === "dose_change" ? (
            <span>
              Dose changed
              {entry.data.old_dose_amount != null &&
                ` from ${entry.data.old_dose_amount}${entry.data.old_dose_unit}`}
              {entry.data.new_dose_amount != null &&
                ` to ${entry.data.new_dose_amount}${entry.data.new_dose_unit}`}
              {entry.data.comment && ` — ${entry.data.comment}`}
            </span>
          ) : (
            <span>
              {entry.data.event === "discontinued" ? "Discontinued" : "Resumed"}
              {entry.data.reason && ` — ${entry.data.reason}`}
              {entry.data.comment && ` (${entry.data.comment})`}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
