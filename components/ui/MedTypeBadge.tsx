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

export function MedTypeBadge({
  type,
  className,
}: {
  type: MedicationType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        STYLES[type],
        className,
      )}
    >
      {LABELS[type]}
    </span>
  );
}
