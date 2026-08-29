"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { Button } from "@/components/ui/Button";
import { getMoodChartScheme } from "@/lib/app-settings";
import { getActiveMedications } from "@/lib/medications";
import {
  createStandaloneLog,
  getHistory,
  getTrend,
  medicationTracksMetric,
  type WellbeingMetric,
} from "@/lib/pain-mood";
import { localDateString } from "@/lib/utils";
import { GraphModal } from "./GraphModal";
import { LogLevelModal, type LogLevelSubmitInput } from "./LogLevelModal";
import { MedicationSelector } from "./MedicationSelector";
import { rangeDatesForDays, TrendChart, type RangeDays } from "./TrendChart";
import { LevelHistoryList } from "./LevelHistoryList";

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
  const { activeProfileId, isResolving } = useActiveProfile();
  const today = localDateString();
  const [selectedMedicationId, setSelectedMedicationId] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState<RangeDays>(0);
  // Which medication's (or Independent's) dedicated graph modal is open,
  // if any — separate from selectedMedicationId, which drives the
  // page-level trend section/history below rather than the modal.
  const [graphTarget, setGraphTarget] = useState<{ id: string | null; name: string } | null>(
    null,
  );

  // A medication selected under a different profile no longer belongs
  // to what's visible now — reset to "Independent" rather than keep
  // querying that specific (now-hidden) medication's trend/history.
  // Adjusted during render (React's documented pattern for "reset state
  // when a prop changes"), matching GroupModal's own use of the same
  // pattern, rather than a useEffect+setState.
  const [lastProfileId, setLastProfileId] = useState(activeProfileId);
  if (activeProfileId !== lastProfileId) {
    setLastProfileId(activeProfileId);
    setSelectedMedicationId(null);
  }

  const medicationsQuery = useQuery({
    queryKey: ["medications", "active", activeProfileId],
    queryFn: () => getActiveMedications(activeProfileId),
    enabled: !isResolving,
  });

  const moodSchemeQuery = useQuery({
    queryKey: ["app-settings", "mood_chart_scheme"],
    queryFn: getMoodChartScheme,
  });

  const trackedMedications = useMemo(
    () => (medicationsQuery.data ?? []).filter((med) => medicationTracksMetric(metric, med)),
    [medicationsQuery.data, metric],
  );

  const { start, end } = rangeDatesForDays(rangeDays, today);
  const trendQuery = useQuery({
    queryKey: ["wellbeing-trend", metric, selectedMedicationId, start, end, activeProfileId],
    queryFn: () => getTrend(metric, selectedMedicationId, start, end, activeProfileId),
    enabled: !isResolving,
  });
  const historyQuery = useQuery({
    queryKey: ["wellbeing-history", metric, selectedMedicationId, activeProfileId],
    queryFn: () => getHistory(metric, selectedMedicationId, 50, activeProfileId),
    enabled: !isResolving,
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
        profileId: activeProfileId,
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

      {trackedMedications.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-bold text-brand-navy">Tracked medications</h2>
          <ul className="flex flex-col gap-2">
            {trackedMedications.map((med) => (
              <li
                key={med.id}
                className="flex items-center justify-between gap-3 rounded-card border border-brand-border bg-brand-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-brand-text">{med.name}</p>
                  {med.dose && <p className="text-xs text-brand-text-muted">{med.dose}</p>}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  className="shrink-0"
                  onClick={() => setGraphTarget({ id: med.id, name: med.name })}
                >
                  View {metric} graph
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-bold text-brand-navy">
          {metric === "pain" ? "Pain" : "Mood"} trend
        </h2>
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
          moodChartScheme={moodSchemeQuery.data}
        />
      </div>

      <GraphModal
        metric={metric}
        medicationId={graphTarget?.id ?? null}
        medicationName={graphTarget?.name ?? ""}
        open={graphTarget !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setGraphTarget(null);
        }}
        profileId={activeProfileId}
        moodChartScheme={moodSchemeQuery.data}
      />

      <div>
        <h2 className="mb-3 text-lg font-bold text-brand-navy">
          {metric === "pain" ? "Pain" : "Mood"} log history
        </h2>
        <LevelHistoryList
          metric={metric}
          points={historyQuery.data ?? []}
          medicationId={selectedMedicationId}
          medications={trackedMedications}
          renderTagPicker={renderTagPicker}
          onSaved={() => {
            toast.success(`${metric === "pain" ? "Pain" : "Mood"} log updated`);
            queryClient.invalidateQueries({ queryKey: ["wellbeing-trend", metric] });
            queryClient.invalidateQueries({ queryKey: ["wellbeing-history", metric] });
          }}
          onDeleted={() => {
            toast.success(`${metric === "pain" ? "Pain" : "Mood"} log deleted`);
            queryClient.invalidateQueries({ queryKey: ["wellbeing-trend", metric] });
            queryClient.invalidateQueries({ queryKey: ["wellbeing-history", metric] });
          }}
        />
      </div>
    </div>
  );
}
