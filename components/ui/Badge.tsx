import { cn } from "@/lib/cn";

export type BadgeVariant = "taken" | "late" | "missed" | "skipped" | "pending" | "snoozed";

// Per the brand tokens: success = taken/on-time, warning = late/pending/
// snoozed, danger = missed/skipped.
const VARIANT_STYLES: Record<BadgeVariant, string> = {
  taken: "bg-status-success/10 text-status-success",
  late: "bg-status-warning/10 text-status-warning",
  pending: "bg-status-warning/10 text-status-warning",
  snoozed: "bg-brand-blue/10 text-brand-blue",
  missed: "bg-status-danger/10 text-status-danger",
  skipped: "bg-status-warning/10 text-status-warning",
};

const VARIANT_LABELS: Record<BadgeVariant, string> = {
  taken: "Taken",
  late: "Late",
  pending: "Pending",
  snoozed: "Snoozed",
  missed: "Missed",
  skipped: "Skipped",
};

export function Badge({
  variant,
  className,
  children,
}: {
  variant: BadgeVariant;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        VARIANT_STYLES[variant],
        className,
      )}
    >
      {children ?? VARIANT_LABELS[variant]}
    </span>
  );
}
