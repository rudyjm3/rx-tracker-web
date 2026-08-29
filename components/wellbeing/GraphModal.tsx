"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import type { MoodChartScheme } from "@/lib/app-settings";
import { getTrend, type WellbeingMetric } from "@/lib/pain-mood";
import { localDateString } from "@/lib/utils";
import { rangeDatesForDays, TrendChart, type RangeDays } from "./TrendChart";

interface GraphModalProps {
  metric: WellbeingMetric;
  // null = the "Independent" (no medication) bucket.
  medicationId: string | null;
  medicationName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId?: string | null;
  moodChartScheme?: MoodChartScheme;
}

// Pain/Mood Graph Modal (spec: range tabs, print button, SVG/canvas
// chart, day drill-down, empty state). Range tabs and day drill-down
// already live inside TrendChart — reused here rather than
// reimplemented — so this component just owns the modal chrome, its
// own trend query for whichever medication (or Independent) it was
// opened for, and the print button.
export function GraphModal({
  metric,
  medicationId,
  medicationName,
  open,
  onOpenChange,
  profileId,
  moodChartScheme,
}: GraphModalProps) {
  const [rangeDays, setRangeDays] = useState<RangeDays>(0);
  const today = localDateString();
  const { start, end } = rangeDatesForDays(rangeDays, today);

  const trendQuery = useQuery({
    queryKey: ["wellbeing-trend", metric, medicationId, start, end, profileId],
    queryFn: () => getTrend(metric, medicationId, start, end, profileId),
    enabled: open,
  });

  const metricLabel = metric === "pain" ? "Pain" : "Mood";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="wide">
        <DialogHeader className="flex flex-row items-center justify-between gap-3 pr-8">
          <DialogTitle>
            {metricLabel} graph — {medicationName}
          </DialogTitle>
          {/* data-no-print: an action control, not report content — same
              convention ExportClient uses for its own print button. The
              surrounding page (everything outside this dialog's portal)
              is hidden via data-no-print on the page's <main>, so
              printing from here prints just this chart. */}
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

        {/* Keyed on the medication so switching targets (or reopening
            for a different one) resets TrendChart's own drill-down
            state instead of showing a stale selected day. */}
        <TrendChart
          key={medicationId ?? "independent"}
          metric={metric}
          points={trendQuery.data ?? []}
          rangeDays={rangeDays}
          onRangeChange={setRangeDays}
          moodChartScheme={moodChartScheme}
        />
      </DialogContent>
    </Dialog>
  );
}
