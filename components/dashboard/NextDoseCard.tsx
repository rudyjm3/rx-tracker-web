"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { MedTypeBadge } from "@/components/ui/MedTypeBadge";
import { MedicationNameWithDose } from "@/components/ui/MedicationNameWithDose";
import { to12h } from "@/lib/utils";
import type { NextDoseEvent } from "@/lib/schedule";
import { DoseFormIcon } from "./DoseFormIcon";

function DoseBadge({ dose }: { dose: string }) {
  if (!dose) return null;
  return (
    <span className="inline-flex w-fit items-center rounded-full border border-cyan-300/40 bg-cyan-500/25 px-3 py-1 text-xs font-extrabold text-white shadow-sm">
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
    <div className="relative flex min-h-[330px] flex-col rounded-[28px] border border-white/20 bg-white/10 px-6 py-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_18px_45px_rgba(7,29,61,0.20)] backdrop-blur-md sm:px-8">
      <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-white/75">
        <Clock size={15} />
        Next dose
      </p>

      {!next ? (
        <p className="mt-6 text-2xl font-bold text-white">
          All scheduled doses complete for today.
        </p>
      ) : (
        <div className="mt-3 flex flex-1 items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-4xl font-extrabold leading-tight text-white">{to12h(hhmm(next.time))}</p>

            {next.kind === "single" ? (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-extrabold text-white">
                    <MedicationNameWithDose
                      medication={next.slot.medication}
                      doseClassName="text-[0.875em] font-bold text-white/75"
                    />
                  </h2>
                  <MedTypeBadge type={next.slot.medication.medication_type} />
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-3 text-2xl font-extrabold text-white">{next.groupName}</h2>
                <p className="mt-1 text-base font-bold text-white/80">
                  {next.members.length} medications in group
                </p>
                <button
                  type="button"
                  onClick={() => setExpanded((e) => !e)}
                  className="mt-5 flex h-12 w-full items-center justify-center border border-white/25 bg-white/15 text-sm font-extrabold text-white underline underline-offset-2 transition hover:bg-white/20"
                >
                  {expanded ? "hide group meds" : "view group meds"}
                </button>
                {expanded && (
                  <ul className="mt-5 flex flex-col gap-3">
                    {next.members.map((m) => (
                      <li key={m.medicationId} className="flex items-center gap-3 text-base text-white/95">
                        <MedicationNameWithDose
                          medication={m.medication}
                          className="font-medium"
                          doseClassName="text-[0.875em] font-bold text-white/75"
                        />
                        <MedTypeBadge type={m.medication.medication_type} />
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="hidden self-center sm:block">
            <DoseFormIcon doseForm={eventDoseForm(next)} size={104} />
          </div>
        </div>
      )}

      {upcoming && (
        <div className="mt-6 border-t border-white/20 pt-5">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/65">Upcoming</p>
          <div className="mt-4 flex items-center justify-between gap-3 text-lg text-white/95">
            <div className="flex min-w-0 items-center gap-2">
              <span className="font-extrabold">{to12h(hhmm(upcoming.time))}</span>
              {upcoming.kind === "single" ? (
                <MedicationNameWithDose
                  medication={upcoming.slot.medication}
                  className="truncate font-extrabold"
                  doseClassName="text-[0.875em] font-bold text-white/75"
                />
              ) : (
                <span className="truncate font-extrabold">{upcoming.groupName}</span>
              )}
            </div>
            <DoseBadge
              dose={upcoming.kind === "single" ? "" : (upcoming.members[0]?.dose ?? "")}
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
