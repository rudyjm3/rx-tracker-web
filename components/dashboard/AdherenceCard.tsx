"use client";

import { CalendarCheck } from "lucide-react";
import type { AdherenceStats } from "@/lib/adherence";
import { AdherenceRing } from "./AdherenceRing";

export function AdherenceCard({ stats }: { stats: AdherenceStats }) {
  return (
    <div className="flex min-h-[330px] flex-col justify-center rounded-[28px] border border-white/20 bg-white/10 px-6 py-7 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_18px_45px_rgba(7,29,61,0.20)] backdrop-blur-md">
      <p className="flex items-center gap-2 self-start text-xs font-extrabold uppercase tracking-[0.16em] text-white/70">
        <CalendarCheck size={15} />
        Today&apos;s adherence
      </p>
      <div className="flex flex-1 items-center justify-center">
        <AdherenceRing percent={stats.percent} size={148} />
      </div>
      <div className="mx-auto w-fit text-left text-base leading-8 text-white/90">
        <p>
          Required doses taken: {stats.requiredTaken} of {stats.requiredTotal}
        </p>
        {stats.requiredTaken > 0 && (
          <p className="mt-0.5">
            On time: {stats.onTime} · Late: {stats.late} · Skipped: {stats.skipped}
          </p>
        )}
        <p>Missed required doses today: {stats.missed}</p>
      </div>
    </div>
  );
}
