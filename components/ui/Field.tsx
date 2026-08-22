import { cn } from "@/lib/cn";

export const inputClass =
  "rounded-control border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-blue disabled:opacity-50";

export function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1 text-sm text-brand-text", className)}>
      {label}
      {children}
      {error && <span className="text-xs text-status-danger">{error}</span>}
    </label>
  );
}
