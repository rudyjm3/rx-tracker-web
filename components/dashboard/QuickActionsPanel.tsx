import Link from "next/link";
import { ChevronRight, LineChart, Pill, Plus, Smile } from "lucide-react";

const ACTIONS = [
  { href: "/medications/new", label: "Add medication", icon: Plus, tint: "bg-brand-deep-blue" },
  { href: "/pain-tracking", label: "Pain tracking", icon: LineChart, tint: "bg-status-warning" },
  { href: "/mood-wellbeing", label: "Mood & Wellbeing", icon: Smile, tint: "bg-brand-cyan" },
  { href: "/medications", label: "Manage medications", icon: Pill, tint: "bg-brand-blue" },
];

export function QuickActionsPanel() {
  return (
    <div className="rounded-card border border-brand-border bg-brand-card p-4 shadow-card">
      <h3 className="mb-2 font-bold text-brand-navy">Quick actions</h3>
      <div className="flex flex-col">
        {ACTIONS.map(({ href, label, icon: Icon, tint }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 border-b border-brand-border py-2.5 last:border-0 hover:opacity-80"
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${tint}`}>
              <Icon size={16} />
            </span>
            <span className="flex-1 text-sm font-medium text-brand-text">{label}</span>
            <ChevronRight size={16} className="text-brand-text-muted" />
          </Link>
        ))}
      </div>
    </div>
  );
}
