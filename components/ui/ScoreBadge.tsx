import { moodBandLabel, moodBandStyle, painBandLabel, painBandStyle } from "@/lib/scoreBands";

export function ScoreBadge({ type, level }: { type: "pain" | "mood"; level: number }) {
  const style = type === "pain" ? painBandStyle(level) : moodBandStyle(level);
  const label = type === "pain" ? painBandLabel(level) : moodBandLabel(level);
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className="text-brand-text-muted">
        {type === "pain" ? "Pain Score" : "Mood Score"}
      </span>
      <span className={`rounded-full px-2 py-0.5 font-medium ${style}`}>
        {level}/10 · {label}
      </span>
    </span>
  );
}
