"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { MedTypeBadge } from "@/components/ui/MedTypeBadge";
import { to12h } from "@/lib/utils";
import type { NextDoseEvent } from "@/lib/schedule";
import { DoseFormIcon } from "./DoseFormIcon";

function DoseBadge({ dose }: { dose: string }) {
  if (!dose) return null;
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white">
      {dose}
    </span>
  );
}

function eventDoseForm(event: NextDoseEvent): string | null {
  return event.kind === "group"
    ? (event.members[0]?.medication.dose_form ?? null)
    : event.slot.medication.dose_form;
}

interface NextDoseCardProps {
  events: NextDoseEvent[];
}

export function NextDoseCard({ events }: NextDoseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const next = events[0] ?? null;
  const upcoming = next ? events.find((e) => e.time > next.time) : undefined;

  return (
    <div className="flex-1 rounded-card bg-white/10 p-5 backdrop-blur-md">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-white/70">
        <Clock size={13} />
        Next dose
      </p>

      {!next ? (
        <p className="mt-3 text-white/90">
          All scheduled doses complete for today.
        </p>
      ) : (
        <div className="mt-1 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="mt-1 text-3xl font-bold text-white">{to12h(hhmm(next.time))}</p>

            {next.kind === "single" ? (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-white">{next.slot.medicationName}</h2>
                  <MedTypeBadge type={next.slot.medication.medication_type} />
                </div>
                <div className="mt-1.5">
                  <DoseBadge dose={next.slot.dose} />
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-2 text-lg font-bold text-white">{next.groupName}</h2>
                <p className="text-sm text-white/80">
                  {next.members.length} medications in group
                </p>
                <button
                  type="button"
                  onClick={() => setExpanded((e) => !e)}
                  className="mt-1.5 text-xs font-medium text-white underline underline-offset-2"
                >
                  {expanded ? "hide group meds" : "view group meds"}
                </button>
                {expanded && (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {next.members.map((m) => (
                      <li key={m.medicationId} className="flex items-center gap-2 text-sm text-white/90">
                        <span className="font-medium">{m.medicationName}</span>
                        <MedTypeBadge type={m.medication.medication_type} />
                        {m.dose && <span className="text-white/70">{m.dose}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <DoseFormIcon doseForm={eventDoseForm(next)} />
        </div>
      )}

      {upcoming && (
        <div className="mt-4 border-t border-white/20 pt-3">
          <p className="text-xs uppercase tracking-wide text-white/70">Upcoming</p>
          <div className="mt-1.5 flex items-center justify-between gap-3 text-sm text-white/90">
            <div className="flex min-w-0 items-center gap-2">
              <span className="font-medium">{to12h(hhmm(upcoming.time))}</span>
              <span className="truncate">
                {upcoming.kind === "single" ? upcoming.slot.medicationName : upcoming.groupName}
              </span>
            </div>
            <DoseBadge
              dose={upcoming.kind === "single" ? upcoming.slot.dose : (upcoming.members[0]?.dose ?? "")}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function hhmm(epochMs: number): string {
  const d = new Date(epochMs);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
