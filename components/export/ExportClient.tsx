"use client";

import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { useAuth } from "@/components/layout/AuthProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { computeAdherence } from "@/lib/adherence";
import { getDoseLogHistory, getDoseLogStatusesInRange } from "@/lib/dose-logs";
import { getActiveMedications, getInactiveMedications } from "@/lib/medications";
import { getTrend, medicationTracksMood, medicationTracksPain } from "@/lib/pain-mood";
import { getSideEffectsInRange } from "@/lib/side-effects";
import { localDateString, to12h } from "@/lib/utils";
import type { Medication } from "@/lib/types/medications";
import { ReportTrendChart } from "./ReportTrendChart";

const HISTORY_CAP = 500;

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return localDateString(d);
}

function formatSchedule(med: Medication): string {
  if (med.as_needed) return "As needed";
  if (med.schedule_mode === "interval" && med.interval_hours && med.first_dose_time) {
    return `Every ${med.interval_hours}h from ${to12h(med.first_dose_time.slice(0, 5))}`;
  }
  const times = med.medication_schedule_times ?? [];
  if (times.length === 0) return "—";
  return times.map((t) => to12h(t.reminder_time.slice(0, 5))).join(", ");
}

export function ExportClient() {
  const { user } = useAuth();
  const { activeProfileId, isResolving } = useActiveProfile();
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(localDateString);
  const generatedAt = useMemo(() => new Date().toLocaleString(), []);

  const medicationsQuery = useQuery({
    queryKey: ["medications", "active", activeProfileId],
    queryFn: () => getActiveMedications(activeProfileId),
    enabled: !isResolving,
  });
  const medications = useMemo(() => medicationsQuery.data ?? [], [medicationsQuery.data]);

  // A medication discontinued partway through the selected range still
  // has dose history/side effects worth including in the report, so the
  // range queries below scope to active *and* inactive medications for
  // this profile — only the "Active medications" list panel is
  // active-only.
  const inactiveMedicationsQuery = useQuery({
    queryKey: ["medications", "inactive", activeProfileId],
    queryFn: () => getInactiveMedications(activeProfileId),
    enabled: !isResolving,
  });
  const allMedicationIds = useMemo(
    () => [
      ...medications.map((m) => m.id),
      ...(inactiveMedicationsQuery.data ?? []).map((m) => m.id),
    ],
    [medications, inactiveMedicationsQuery.data],
  );

  const doseLogsQuery = useQuery({
    queryKey: ["export-dose-logs", startDate, endDate, allMedicationIds],
    queryFn: () =>
      getDoseLogHistory({
        startDate,
        endDate,
        medicationIds: allMedicationIds,
        limit: HISTORY_CAP,
        offset: 0,
      }),
    enabled: inactiveMedicationsQuery.data !== undefined,
  });
  const doseLogs = doseLogsQuery.data ?? [];

  const sideEffectsQuery = useQuery({
    queryKey: ["export-side-effects", startDate, endDate, allMedicationIds],
    queryFn: () => getSideEffectsInRange(startDate, endDate, allMedicationIds),
    enabled: inactiveMedicationsQuery.data !== undefined,
  });
  const sideEffects = sideEffectsQuery.data ?? [];

  // A separate, uncapped query — doseLogs above is capped at
  // HISTORY_CAP for the display table, but adherence must reflect the
  // full selected range, not just whichever rows happen to fit under
  // that cap.
  const adherenceStatusesQuery = useQuery({
    queryKey: ["export-adherence-statuses", startDate, endDate, allMedicationIds],
    queryFn: () => getDoseLogStatusesInRange(startDate, endDate, allMedicationIds),
    enabled: inactiveMedicationsQuery.data !== undefined,
  });
  const adherenceStatuses = adherenceStatusesQuery.data ?? [];

  const adherenceEligibleMeds = useMemo(
    () => medications.filter((m) => !m.as_needed && m.adherence_enabled),
    [medications],
  );
  const eligibleIds = useMemo(
    () => new Set(adherenceEligibleMeds.map((m) => m.id)),
    [adherenceEligibleMeds],
  );
  const overallAdherence = computeAdherence(
    adherenceStatuses.filter((l) => eligibleIds.has(l.medication_id)),
  );
  const perMedicationAdherence = adherenceEligibleMeds.map((med) => ({
    medication: med,
    percent: computeAdherence(adherenceStatuses.filter((l) => l.medication_id === med.id)),
  }));

  const painTrackedMeds = useMemo(() => medications.filter(medicationTracksPain), [medications]);
  const moodTrackedMeds = useMemo(() => medications.filter(medicationTracksMood), [medications]);

  const painTrendQueries = useQueries({
    queries: painTrackedMeds.map((med) => ({
      queryKey: ["export-trend", "pain", med.id, startDate, endDate],
      queryFn: () => getTrend("pain", med.id, startDate, endDate),
    })),
  });
  const moodTrendQueries = useQueries({
    queries: moodTrackedMeds.map((med) => ({
      queryKey: ["export-trend", "mood", med.id, startDate, endDate],
      queryFn: () => getTrend("mood", med.id, startDate, endDate),
    })),
  });

  const isLoading =
    isResolving ||
    medicationsQuery.isLoading ||
    inactiveMedicationsQuery.isLoading ||
    doseLogsQuery.isLoading ||
    sideEffectsQuery.isLoading ||
    adherenceStatusesQuery.isLoading ||
    painTrendQueries.some((q) => q.isLoading) ||
    moodTrendQueries.some((q) => q.isLoading);

  return (
    <div className="flex flex-col gap-6">
      <div data-no-print className="flex flex-wrap items-end gap-3">
        <Field label="From">
          <input
            type="date"
            className={inputClass}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Field label="To">
          <input
            type="date"
            className={inputClass}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </Field>
        <Button type="button" onClick={() => window.print()} disabled={isLoading}>
          Print / Save as PDF
        </Button>
      </div>

      <div className="flex flex-col gap-8 rounded-card border border-brand-border bg-brand-card p-6 shadow-card print:border-none print:p-0 print:shadow-none">
        <header data-report-section className="flex flex-col gap-1 border-b border-brand-border pb-4">
          <h1 className="text-2xl font-bold text-brand-navy">RxTracker Summary</h1>
          <p className="text-sm text-brand-text-muted">{user?.email}</p>
          <p className="text-sm text-brand-text-muted">
            Period: {startDate} to {endDate}
          </p>
          <p className="text-xs text-brand-text-muted">Generated {generatedAt}</p>
        </header>

        {isLoading ? (
          <p className="text-brand-text-muted">Loading report…</p>
        ) : (
          <>
            <section data-report-section>
              <h2 className="mb-3 text-lg font-bold text-brand-navy">Adherence</h2>
              <p className="text-sm text-brand-text">
                Overall: <span className="font-semibold">{overallAdherence}%</span>
              </p>
              {perMedicationAdherence.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {perMedicationAdherence.map(({ medication, percent }) => (
                    <li key={medication.id} className="flex justify-between text-sm text-brand-text-muted">
                      <span>{medication.name}</span>
                      <span>{percent}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section data-report-section>
              <h2 className="mb-3 text-lg font-bold text-brand-navy">Medications</h2>
              {medications.length === 0 ? (
                <p className="text-sm text-brand-text-muted">No active medications.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {medications.map((med) => (
                    <li key={med.id} className="text-sm">
                      <span className="font-medium text-brand-text">{med.name}</span>
                      {med.dose && <span className="text-brand-text-muted"> · {med.dose}</span>}
                      <span className="block text-xs text-brand-text-muted">
                        {formatSchedule(med)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {painTrackedMeds.map((med, i) => (
              <section key={med.id} data-report-section>
                <h2 className="mb-3 text-lg font-bold text-brand-navy">
                  Pain trend — {med.name}
                </h2>
                <ReportTrendChart metric="pain" points={painTrendQueries[i]?.data ?? []} />
              </section>
            ))}

            {moodTrackedMeds.map((med, i) => (
              <section key={med.id} data-report-section>
                <h2 className="mb-3 text-lg font-bold text-brand-navy">
                  Mood trend — {med.name}
                </h2>
                <ReportTrendChart metric="mood" points={moodTrendQueries[i]?.data ?? []} />
              </section>
            ))}

            <section data-report-section>
              <h2 className="mb-3 text-lg font-bold text-brand-navy">Side effects</h2>
              {sideEffects.length === 0 ? (
                <p className="text-sm text-brand-text-muted">None reported for this period.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {sideEffects.map((se) => (
                    <li key={se.id} className="text-sm">
                      <span className="font-medium text-brand-text">{se.occurred_date}</span>
                      {" — "}
                      {se.medications.name}: {se.description} ({se.severity})
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section data-report-section>
              <h2 className="mb-3 text-lg font-bold text-brand-navy">Dose history</h2>
              {doseLogs.length === 0 ? (
                <p className="text-sm text-brand-text-muted">No doses logged for this period.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {doseLogs.map((log) => (
                    <li
                      key={log.id}
                      className="flex items-center justify-between gap-2 border-b border-brand-border py-1 text-sm"
                    >
                      <span className="text-brand-text-muted">
                        {log.scheduled_for_date} · {to12h(log.scheduled_time.slice(0, 5))}
                      </span>
                      <span className="flex-1 truncate px-2 text-brand-text">
                        {log.medications.name}
                      </span>
                      <Badge variant={log.status === "taken" ? "taken" : log.status} />
                    </li>
                  ))}
                </ul>
              )}
              {doseLogs.length === HISTORY_CAP && (
                <p className="mt-2 text-xs text-brand-text-muted">
                  Showing the first {HISTORY_CAP} entries for this period.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
