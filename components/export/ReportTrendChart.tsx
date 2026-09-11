"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotItemDotProps,
} from "recharts";
import type { MoodChartScheme } from "@/lib/app-settings";
import { levelColor, type DailyAverage, type WellbeingMetric } from "@/lib/pain-mood";

function renderDot(metric: WellbeingMetric, scheme: MoodChartScheme) {
  function LevelDot(props: DotItemDotProps) {
    const { cx, cy, payload, index } = props;
    if (cx == null || cy == null) return null;
    const { level, hasStandalone } = payload as { level: number; hasStandalone: boolean };
    const color = levelColor(metric, level, scheme);
    // A hollow dot flags a day that includes a standalone log entry
    // (not attached to a dose) — matches the reference report's legend.
    return hasStandalone ? (
      <circle
        key={`dot-${index}`}
        cx={cx}
        cy={cy}
        r={4}
        fill="#ffffff"
        stroke={color}
        strokeWidth={2}
      />
    ) : (
      <circle
        key={`dot-${index}`}
        cx={cx}
        cy={cy}
        r={4}
        fill={color}
        stroke="#ffffff"
        strokeWidth={1.5}
      />
    );
  }
  return LevelDot;
}

interface ReportTrendChartProps {
  metric: WellbeingMetric;
  dailyAverages: DailyAverage[];
  moodChartScheme?: MoodChartScheme;
}

/**
 * A static daily-average line chart for the export report — no range
 * tabs, no day drill-down (unlike TrendChart, which is interactive for
 * the pain-tracking/mood-wellbeing pages); the report's own date range
 * already scopes the data, and a printed page has no click handlers.
 * Takes already-grouped daily averages (via groupDailyAverages) rather
 * than raw TrendPoints, since the caller computes that once and shares
 * it with the generated PDF's own chart.
 */
export function ReportTrendChart({
  metric,
  dailyAverages,
  moodChartScheme = "classic",
}: ReportTrendChartProps) {
  const metricLabel = metric === "pain" ? "Pain" : "Mood";

  if (dailyAverages.length === 0) {
    return (
      <p className="text-sm text-brand-text-muted">
        No {metric} level data recorded for this period.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={dailyAverages}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-brand-border)" />
        <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} />
        <YAxis domain={[1, 10]} ticks={[1, 5, 10]} />
        <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}/10`, metricLabel]} />
        <Line
          type="monotone"
          dataKey="level"
          stroke="var(--color-brand-blue)"
          dot={renderDot(metric, moodChartScheme)}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
