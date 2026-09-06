import { cn } from "@/lib/cn";
import type { FeedbackType } from "@/lib/types/medications";

const LABELS = { pain: "Pain", mood: "Mood" } as const;

const STYLES = {
  pain: "border-status-warning text-status-warning",
  mood: "border-brand-purple text-brand-purple",
} as const;

export function FeedbackChip({
  type,
  className,
}: {
  type: "pain" | "mood";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        STYLES[type],
        className,
      )}
    >
      {LABELS[type]}
    </span>
  );
}

// A medication with feedback_type "both" renders both chips; "none"
// renders neither — mirrors medicationTracksPain/medicationTracksMood
// in lib/pain-mood.ts.
export function feedbackChipTypes(feedbackType: FeedbackType): ("pain" | "mood")[] {
  if (feedbackType === "both") return ["pain", "mood"];
  if (feedbackType === "pain" || feedbackType === "mood") return [feedbackType];
  return [];
}
