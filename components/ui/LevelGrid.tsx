import { cn } from "@/lib/cn";

interface LevelGridProps {
  value: number | null;
  onChange: (level: number) => void;
  label: string;
  hint: string;
  metric?: "pain" | "mood";
}

// Same tier colors as the original app's .pain-log-level-btn / .mood-log-level-btn
// (mood uses an inverted scale — low mood is red, high mood is green).
function tierColor(metric: "pain" | "mood", level: number): string {
  if (metric === "mood") {
    if (level <= 3) return "#c9213c";
    if (level <= 6) return "#d97706";
    if (level <= 8) return "#8bb04a";
    return "#2a9d49";
  }
  if (level <= 3) return "#2a9d49";
  if (level <= 6) return "#d97706";
  if (level <= 8) return "#e05b30";
  return "#c9213c";
}

export function LevelGrid({ value, onChange, label, hint, metric = "pain" }: LevelGridProps) {
  return (
    <div>
      <p className="text-sm font-medium text-brand-text">
        {label} <span className="text-xs font-normal text-brand-text-muted">{hint}</span>
      </p>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((level) => {
          const color = tierColor(metric, level);
          const selected = value === level;
          return (
            <button
              key={level}
              type="button"
              onClick={() => onChange(level)}
              style={
                {
                  "--tier-color": color,
                  borderColor: color,
                  backgroundColor: selected ? color : "var(--color-brand-bg)",
                  color: selected ? "#fff" : "var(--color-brand-text-muted)",
                } as React.CSSProperties
              }
              className={cn(
                "rounded-full border-2 py-1.5 text-sm font-bold transition",
                "hover:!bg-[var(--tier-color)] hover:!text-white",
              )}
            >
              {level}
            </button>
          );
        })}
      </div>
    </div>
  );
}
