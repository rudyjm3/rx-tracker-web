"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { MedicationNameWithDose } from "@/components/ui/MedicationNameWithDose";
import { cn } from "@/lib/cn";
import { getMoodChartScheme } from "@/lib/app-settings";
import {
  getTrend,
  medicationTracksMood,
  medicationTracksPain,
  type WellbeingMetric,
} from "@/lib/pain-mood";
import type { Medication } from "@/lib/types/medications";
import { localDateString } from "@/lib/utils";
import { rangeDatesForDays, RangeTabs, TrendChart, type RangeDays } from "../wellbeing/TrendChart";

type TrendView = WellbeingMetric | "both";

interface MedicationTrendModalProps {
  medication: Medication;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Single entry point for a medication card's tracking icon, whether the
// medication tracks pain, mood, or both — one icon opens this modal
// regardless, and when both are tracked the user picks pain, mood, or a
// combined view here rather than getting two separate icons/modals.
export function MedicationTrendModal({ medication, open, onOpenChange }: MedicationTrendModalProps) {
  const tracksPain = medicationTracksPain(medication);
  const tracksMood = medicationTracksMood(medication);
  const tracksBoth = tracksPain && tracksMood;

  const [view, setView] = useState<TrendView>(() =>
    tracksBoth ? "both" : tracksPain ? "pain" : "mood",
  );
  const [rangeDays, setRangeDays] = useState<RangeDays>(0);

  const today = localDateString();
  const { start, end } = rangeDatesForDays(rangeDays, today);

  const showPain = view === "pain" || view === "both";
  const showMood = view === "mood" || view === "both";

  const painQuery = useQuery({
    queryKey: ["wellbeing-trend", "pain", medication.id, start, end],
    queryFn: () => getTrend("pain", medication.id, start, end),
    enabled: open && showPain,
  });
  const moodQuery = useQuery({
    queryKey: ["wellbeing-trend", "mood", medication.id, start, end],
    queryFn: () => getTrend("mood", medication.id, start, end),
    enabled: open && showMood,
  });
  const moodSchemeQuery = useQuery({
    queryKey: ["app-settings", "mood_chart_scheme"],
    queryFn: getMoodChartScheme,
    enabled: open && showMood,
  });

  const titleLabel = view === "both" ? "Pain & mood" : view === "pain" ? "Pain" : "Mood";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="wide">
        <DialogHeader className="flex flex-row items-center justify-between gap-3 pr-8">
          <DialogTitle>
            {titleLabel} trend — <MedicationNameWithDose medication={medication} />
          </DialogTitle>
          {/* data-no-print: an action control, not report content — same
              convention GraphModal's print button uses. */}
          <Button
            type="button"
            variant="secondary"
            size="compact"
            data-no-print
            onClick={() => window.print()}
          >
            <Printer size={14} />
            Print
          </Button>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {tracksBoth && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Metric">
              {(
                [
                  { key: "pain" as const, label: "Pain" },
                  { key: "mood" as const, label: "Mood" },
                  { key: "both" as const, label: "Both" },
                ]
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setView(opt.key)}
                  className={cn(
                    "rounded-control px-3 py-1.5 text-sm font-semibold transition",
                    view === opt.key
                      ? "bg-brand-navy text-white"
                      : "border border-brand-border bg-white text-brand-navy hover:bg-brand-bg",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          <RangeTabs rangeDays={rangeDays} onRangeChange={setRangeDays} />

          {view === "both" ? (
            <div className="flex flex-col gap-5">
              <div>
                <p className="mb-2 text-sm font-semibold text-brand-navy">Pain</p>
                <TrendChart
                  metric="pain"
                  points={painQuery.data ?? []}
                  rangeDays={rangeDays}
                  onRangeChange={setRangeDays}
                  hideRangeTabs
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-brand-navy">Mood</p>
                <TrendChart
                  metric="mood"
                  points={moodQuery.data ?? []}
                  rangeDays={rangeDays}
                  onRangeChange={setRangeDays}
                  moodChartScheme={moodSchemeQuery.data}
                  hideRangeTabs
                />
              </div>
            </div>
          ) : (
            <TrendChart
              metric={view}
              points={(view === "pain" ? painQuery.data : moodQuery.data) ?? []}
              rangeDays={rangeDays}
              onRangeChange={setRangeDays}
              moodChartScheme={view === "mood" ? moodSchemeQuery.data : undefined}
              hideRangeTabs
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
