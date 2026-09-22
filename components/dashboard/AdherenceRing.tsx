"use client";

function ringGeometry(size: number, strokeWidth: number) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  return { radius, circumference };
}

export function AdherenceRing({
  percent,
  innerPercent,
  size = 148,
}: {
  percent: number;
  /** Non-required (optional-dose) percent, drawn as a nested ring in a
   * different color. Omitted entirely when there's nothing to track. */
  innerPercent?: number;
  size?: number;
}) {
  const strokeWidth = 12;
  const outer = ringGeometry(size, strokeWidth);
  const outerOffset = outer.circumference * (1 - percent / 100);

  const hasInner = innerPercent !== undefined;
  const innerStrokeWidth = 9;
  const innerSize = size - (strokeWidth + 10) * 2;
  const innerOffsetXY = (size - innerSize) / 2;
  const inner = hasInner ? ringGeometry(innerSize, innerStrokeWidth) : null;
  const innerDashOffset = inner ? inner.circumference * (1 - (innerPercent ?? 0) / 100) : 0;

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        hasInner
          ? `${percent}% required adherence, ${innerPercent}% non-required adherence today`
          : `${percent}% adherence today`
      }
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={outer.radius}
          fill="none"
          stroke="rgba(167, 205, 240, 0.42)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={outer.radius}
          fill="none"
          stroke="rgba(196, 225, 250, 0.95)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={outer.circumference}
          strokeDashoffset={outerOffset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        {hasInner && inner && (
          <g transform={`translate(${innerOffsetXY}, ${innerOffsetXY})`}>
            <circle
              cx={innerSize / 2}
              cy={innerSize / 2}
              r={inner.radius}
              fill="none"
              stroke="rgba(255, 197, 66, 0.3)"
              strokeWidth={innerStrokeWidth}
            />
            <circle
              cx={innerSize / 2}
              cy={innerSize / 2}
              r={inner.radius}
              fill="none"
              stroke="rgba(255, 197, 66, 0.95)"
              strokeWidth={innerStrokeWidth}
              strokeLinecap="round"
              strokeDasharray={inner.circumference}
              strokeDashoffset={innerDashOffset}
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
          </g>
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="text-3xl font-extrabold">{percent}%</span>
      </div>
    </div>
  );
}
