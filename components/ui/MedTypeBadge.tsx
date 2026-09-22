import { cn } from "@/lib/cn";
import type { MedicationType } from "@/lib/types/medications";

const LABELS: Record<MedicationType, string> = {
  prescription: "Rx",
  otc: "OTC",
  supplement: "Supplement",
};

const STYLES: Record<MedicationType, string> = {
  prescription: "bg-brand-deep-blue/10 text-brand-deep-blue",
  otc: "bg-brand-blue/10 text-brand-blue",
  supplement: "bg-status-warning/10 text-status-warning",
};

// Used on dark/gradient surfaces (the alarm overlay, the dashboard hero
// card) where the default dark-on-light-tint styles above lose all
// contrast against a dark navy or deep-blue background.
const ON_DARK_STYLES: Record<MedicationType, string> = {
  prescription: "border border-white/40 bg-white/20 text-white",
  otc: "border border-white/40 bg-white/20 text-white",
  supplement: "border border-amber-200/50 bg-amber-400/25 text-white",
};

export function MedTypeBadge({
  type,
  className,
  onDark,
}: {
  type: MedicationType;
  className?: string;
  onDark?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        onDark ? ON_DARK_STYLES[type] : STYLES[type],
        className,
      )}
    >
      {LABELS[type]}
    </span>
  );
}
