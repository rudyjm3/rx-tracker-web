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
import { groupDailyAverages, levelColor, type TrendPoint, type WellbeingMetric } from "@/lib/pain-mood";

function renderDot(metric: WellbeingMetric, scheme: MoodChartScheme) {
  function LevelDot(props: DotItemDotProps) {
    const { cx, cy, payload, index } = props;
    if (cx == null || cy == null) return null;
    const level = (payload as { level: number }).level;
    return (
      <circle
        key={`dot-${index}`}
        cx={cx}
        cy={cy}
        r={4}
        fill={levelColor(metric, level, scheme)}
        stroke="#ffffff"
        strokeWidth={1.5}
      />
    );
  }
  return LevelDot;
}

interface ReportTrendChartProps {
  metric: WellbeingMetric;
  points: TrendPoint[];
  moodChartScheme?: MoodChartScheme;
}

/**
 * A static daily-average line chart for the export report — no range
 * tabs, no day drill-down (unlike TrendChart, which is interactive for
 * the pain-tracking/mood-wellbeing pages); the report's own date range
 * already scopes `points`, and a printed page has no click handlers.
 */
export function ReportTrendChart({
  metric,
  points,
  moodChartScheme = "classic",
}: ReportTrendChartProps) {
  const dailyAverages = groupDailyAverages(points);
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
