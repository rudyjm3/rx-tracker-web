import type { AdherenceStats } from "@/lib/adherence";
import type { NextDoseEvent } from "@/lib/schedule";
import { AdherenceCard } from "./AdherenceCard";
import { NextDoseCard } from "./NextDoseCard";

interface HeroPanelProps {
  events: NextDoseEvent[];
  adherenceStats: AdherenceStats;
}

export function HeroPanel({ events, adherenceStats }: HeroPanelProps) {
  return (
    <div className="rounded-hero bg-gradient-brand-hero p-6 shadow-card sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <NextDoseCard events={events} />
        <AdherenceCard stats={adherenceStats} />
      </div>
    </div>
  );
}
