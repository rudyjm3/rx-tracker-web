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
    <section className="overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#18d0dc_0%,#0a8ac8_38%,#0754a8_68%,#071d3d_100%)] px-5 py-8 shadow-[0_22px_60px_rgba(7,29,61,0.24)] sm:px-12 sm:py-12">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-stretch">
        <NextDoseCard events={events} />
        <AdherenceCard stats={adherenceStats} />
      </div>
    </section>
  );
}
