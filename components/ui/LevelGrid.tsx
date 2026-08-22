import { cn } from "@/lib/cn";

interface LevelGridProps {
  value: number | null;
  onChange: (level: number) => void;
  label: string;
  hint: string;
}

export function LevelGrid({ value, onChange, label, hint }: LevelGridProps) {
  return (
    <div>
      <p className="text-sm font-medium text-brand-text">
        {label} <span className="text-xs font-normal text-brand-text-muted">{hint}</span>
      </p>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            className={cn(
              "rounded-control border border-brand-border py-1.5 text-sm font-medium transition",
              value === level
                ? "border-transparent bg-gradient-brand text-white"
                : "bg-white text-brand-text hover:bg-brand-bg",
            )}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );
}
