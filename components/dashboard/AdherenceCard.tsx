"use client";

import { CalendarCheck } from "lucide-react";
import type { AdherenceStats } from "@/lib/adherence";
import { AdherenceRing } from "./AdherenceRing";

export function AdherenceCard({ stats }: { stats: AdherenceStats }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-3 rounded-card bg-white/10 p-5 text-center backdrop-blur-md sm:min-w-[220px] sm:flex-none">
      <p className="flex items-center gap-1.5 self-start text-xs uppercase tracking-wide text-white/70">
        <CalendarCheck size={13} />
        Today&apos;s adherence
      </p>
      <AdherenceRing percent={stats.percent} />
      <div className="text-xs text-white/85">
        <p>
          Required doses taken: {stats.requiredTaken} of {stats.requiredTotal}
        </p>
        {stats.requiredTaken > 0 && (
          <p className="mt-0.5">
            On time: {stats.onTime} · Late: {stats.late} · Skipped: {stats.skipped}
          </p>
        )}
        <p className="mt-0.5">Missed required doses today: {stats.missed}</p>
      </div>
    </div>
  );
}
