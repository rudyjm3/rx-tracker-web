import Link from "next/link";
import { ChevronRight, ClipboardList, ListChecks } from "lucide-react";

interface MedsOverviewPanelProps {
  activeCount: number;
  todaysDosesCount: number;
  dosesTaken: number;
  dosesMissed: number;
  onViewRequiredDoses: () => void;
}

function StatRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: number;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-brand-border py-2 text-sm last:border-0">
      <span className="text-brand-text-muted">{label}</span>
      <span className={`font-semibold text-brand-text ${valueClassName ?? ""}`}>{value}</span>
    </div>
  );
}

export function MedsOverviewPanel({
  activeCount,
  todaysDosesCount,
  dosesTaken,
  dosesMissed,
  onViewRequiredDoses,
}: MedsOverviewPanelProps) {
  return (
    <div className="rounded-card border border-brand-border bg-brand-card p-4 shadow-card">
      <h3 className="mb-2 flex items-center gap-2 font-bold text-brand-navy">
        <ClipboardList size={16} />
        Medications overview
      </h3>
      <div>
        <StatRow label="Active medications" value={activeCount} />
        <StatRow label="Today's doses" value={todaysDosesCount} />
        <StatRow label="Doses taken" value={dosesTaken} valueClassName="text-status-success" />
        <StatRow label="Doses missed" value={dosesMissed} valueClassName="text-status-danger" />
      </div>
      <button
        type="button"
        onClick={onViewRequiredDoses}
        className="mt-2 flex w-full items-center gap-2 py-1.5 text-sm text-brand-deep-blue hover:underline"
      >
        <ListChecks size={15} />
        <span className="flex-1 text-left">View required doses list</span>
        <ChevronRight size={15} />
      </button>
      <Link
        href="/medications"
        className="mt-2 block text-center text-sm font-medium text-brand-deep-blue hover:underline"
      >
        View all medications
      </Link>
    </div>
  );
}
