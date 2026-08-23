"use client";

import { useMemo, useState } from "react";
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
import { cn } from "@/lib/cn";
import { minutesToTime, timeToMinutes, to12h } from "@/lib/utils";
import type { MoodChartScheme } from "@/lib/app-settings";
import {
  groupDailyAverages,
  levelColor,
  type TrendPoint,
  type WellbeingMetric,
} from "@/lib/pain-mood";

export const RANGE_OPTIONS = [
  { label: "Today", days: 0 as const },
  { label: "7 days", days: 7 as const },
  { label: "30 days", days: 30 as const },
  { label: "90 days", days: 90 as const },
];
export type RangeDays = (typeof RANGE_OPTIONS)[number]["days"];

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
        r={5}
        fill={levelColor(metric, level, scheme)}
        stroke="#ffffff"
        strokeWidth={1.5}
      />
    );
  }
  return LevelDot;
}

interface TrendChartProps {
  metric: WellbeingMetric;
  points: TrendPoint[];
  rangeDays: RangeDays;
  onRangeChange: (days: RangeDays) => void;
  moodChartScheme?: MoodChartScheme;
}

export function TrendChart({
  metric,
  points,
  rangeDays,
  onRangeChange,
  moodChartScheme = "classic",
}: TrendChartProps) {
  const [drillDate, setDrillDate] = useState<string | null>(null);

  const showingDay = rangeDays === 0 ? (points[0]?.date ?? null) : drillDate;

  const dayPoints = useMemo(() => {
    if (!showingDay) return [];
    return points
      .filter((p) => p.date === showingDay)
      .map((p) => ({ ...p, x: timeToMinutes(p.time) }))
      .sort((a, b) => a.x - b.x);
  }, [points, showingDay]);

  const dailyAverages = useMemo(() => {
    if (showingDay) return [];
    return groupDailyAverages(points);
  }, [points, showingDay]);

  const hasData = showingDay ? dayPoints.length > 0 : dailyAverages.length > 0;
  const metricLabel = metric === "pain" ? "Pain" : "Mood";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Date range">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            type="button"
            onClick={() => {
              onRangeChange(opt.days);
              setDrillDate(null);
            }}
            className={cn(
              "rounded-control px-3 py-1.5 text-sm font-medium transition",
              rangeDays === opt.days
                ? "bg-gradient-brand text-white"
                : "bg-brand-bg text-brand-text-muted hover:bg-brand-border",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {rangeDays > 0 && drillDate && (
        <button
          type="button"
          onClick={() => setDrillDate(null)}
          className="self-start text-sm text-brand-deep-blue hover:underline"
        >
          ← Back to trend
        </button>
      )}

      {!hasData ? (
        <p className="py-10 text-center text-sm text-brand-text-muted">
          No {metric} level data recorded for this period.
        </p>
      ) : showingDay ? (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={dayPoints}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-brand-border)" />
            <XAxis
              dataKey="x"
              type="number"
              domain={[0, 1440]}
              tickFormatter={(v: number) => to12h(minutesToTime(v))}
            />
            <YAxis domain={[1, 10]} ticks={[1, 3, 5, 7, 10]} />
            <Tooltip
              formatter={(value) => [`${value}/10`, metricLabel]}
              labelFormatter={(v) => to12h(minutesToTime(v as number))}
            />
            <Line
              type="monotone"
              dataKey="level"
              stroke="var(--color-brand-blue)"
              dot={renderDot(metric, moodChartScheme)}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart
            data={dailyAverages}
            onClick={(state) => {
              const label = state?.activeLabel;
              if (typeof label === "string") setDrillDate(label);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-brand-border)" />
            <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} />
            <YAxis domain={[1, 10]} ticks={[1, 3, 5, 7, 10]} />
            <Tooltip
              formatter={(value) => [`${Number(value).toFixed(1)}/10`, metricLabel]}
            />
            <Line
              type="monotone"
              dataKey="level"
              stroke="var(--color-brand-blue)"
              dot={renderDot(metric, moodChartScheme)}
              isAnimationActive={false}
              className="cursor-pointer"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
      {!showingDay && hasData && (
        <p className="text-xs text-brand-text-muted">
          Tip: click a point to see that day&apos;s levels throughout the day.
        </p>
      )}
    </div>
  );
}
