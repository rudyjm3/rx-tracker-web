"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { getActiveMedications } from "@/lib/medications";
import {
  createStandaloneLog,
  getHistory,
  getTrend,
  medicationTracksMetric,
  type WellbeingMetric,
} from "@/lib/pain-mood";
import { localDateString } from "@/lib/utils";
import { LogLevelModal, type LogLevelSubmitInput } from "./LogLevelModal";
import { MedicationSelector } from "./MedicationSelector";
import { TrendChart, type RangeDays } from "./TrendChart";
import { LevelHistoryList } from "./LevelHistoryList";

function rangeDates(rangeDays: RangeDays, today: string): { start: string; end: string } {
  if (rangeDays === 0) return { start: today, end: today };
  const end = new Date(`${today}T00:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - (rangeDays - 1));
  return { start: localDateString(start), end: today };
}

interface WellbeingClientProps {
  metric: WellbeingMetric;
  title: string;
  renderTagPicker?: (selected: string[], onChange: (tags: string[]) => void) => ReactNode;
}

// Pain Tracking and Mood & Wellbeing (build step 6) are otherwise
// identical pages in the reference app — same log modal, medication
// selector, trend chart, and history list, differing only in the metric
// and mood's extra tag picker. Factored into one metric-agnostic
// orchestrator here rather than duplicating it, with PainTrackingClient/
// MoodWellbeingClient as thin per-page wrappers.
export function WellbeingClient({ metric, title, renderTagPicker }: WellbeingClientProps) {
  const queryClient = useQueryClient();
  const { activeProfileId } = useActiveProfile();
  const today = localDateString();
  const [selectedMedicationId, setSelectedMedicationId] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState<RangeDays>(0);

  const medicationsQuery = useQuery({
    queryKey: ["medications", "active", activeProfileId],
    queryFn: () => getActiveMedications(activeProfileId),
  });

  const trackedMedications = useMemo(
    () => (medicationsQuery.data ?? []).filter((med) => medicationTracksMetric(metric, med)),
    [medicationsQuery.data, metric],
  );

  const { start, end } = rangeDates(rangeDays, today);
  const trendQuery = useQuery({
    queryKey: ["wellbeing-trend", metric, selectedMedicationId, start, end],
    queryFn: () => getTrend(metric, selectedMedicationId, start, end),
  });
  const historyQuery = useQuery({
    queryKey: ["wellbeing-history", metric, selectedMedicationId],
    queryFn: () => getHistory(metric, selectedMedicationId, 50),
  });

  const logMutation = useMutation({
    mutationFn: (input: LogLevelSubmitInput) =>
      createStandaloneLog({
        medicationId: input.medicationId,
        logType: metric,
        painLevel: metric === "pain" ? input.level : null,
        moodLevel: metric === "mood" ? input.level : null,
        note: input.note,
        tags: input.tags.join(","),
        loggedAt: input.loggedAt,
      }),
    onSuccess: () => {
      toast.success(`${metric === "pain" ? "Pain" : "Mood"} level logged`);
      queryClient.invalidateQueries({ queryKey: ["wellbeing-trend", metric] });
      queryClient.invalidateQueries({ queryKey: ["wellbeing-history", metric] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't save log");
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-brand-navy">{title}</h1>

      {trackedMedications.length === 0 && (
        <p className="text-sm text-brand-text-muted">
          No medications are currently tracking {metric}. You can still log {metric} independently
          below, or enable {metric} tracking on a medication.
        </p>
      )}

      <LogLevelModal
        metric={metric}
        medications={trackedMedications}
        onSubmit={(input) => logMutation.mutate(input)}
        renderTagPicker={renderTagPicker}
      />

      <div>
        <h2 className="mb-3 text-lg font-bold text-brand-navy">Tracked medications</h2>
        <MedicationSelector
          medications={trackedMedications}
          selectedId={selectedMedicationId}
          onSelect={setSelectedMedicationId}
        />
      </div>

      <div className="rounded-card border border-brand-border bg-brand-card p-4 shadow-card">
        <TrendChart
          metric={metric}
          points={trendQuery.data ?? []}
          rangeDays={rangeDays}
          onRangeChange={setRangeDays}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold text-brand-navy">
          {metric === "pain" ? "Pain" : "Mood"} log history
        </h2>
        <LevelHistoryList metric={metric} points={historyQuery.data ?? []} />
      </div>
    </div>
  );
}
