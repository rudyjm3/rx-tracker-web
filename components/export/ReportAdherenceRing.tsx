// A light-background variant of components/dashboard/AdherenceRing.tsx
// (that one is styled for the gradient hero card) — same SVG
// stroke-dasharray approach, colored by percent bucket to match the
// PDF's ring, for the export report's on-page summary and PDF.
export function ReportAdherenceRing({ percent, size = 72 }: { percent: number; size?: number }) {
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  const color =
    percent >= 80
      ? "var(--color-status-success)"
      : percent >= 50
        ? "var(--color-status-warning)"
        : "var(--color-status-danger)";

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${percent}% overall adherence`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-brand-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-base font-bold" style={{ color }}>
          {percent}%
        </span>
      </div>
    </div>
  );
}
