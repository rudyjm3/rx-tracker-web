"use client";

import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { useAuth } from "@/components/layout/AuthProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field, inputClass } from "@/components/ui/Field";
import { computeAdherence } from "@/lib/adherence";
import { ALLERGY_SEVERITY_LABELS, getProfileAllergies } from "@/lib/allergies";
import { getMoodChartScheme } from "@/lib/app-settings";
import { getDoseLogHistory, getDoseLogStatusesInRange } from "@/lib/dose-logs";
import {
  getActiveMedications,
  getDoseHistory,
  getInactiveMedications,
  type DoseHistoryEntry,
} from "@/lib/medications";
import { getTrend, groupDailyAverages, medicationTracksMood, medicationTracksPain } from "@/lib/pain-mood";
import { getSideEffectsInRange } from "@/lib/side-effects";
import { daysUntilRunout, localDateString, to12h } from "@/lib/utils";
import type { Medication, MedicationDoseChange } from "@/lib/types/medications";
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

// "42 tablets" style, matching the LowSupplyBanner/MedicationCard
// convention elsewhere in the app — "—" when supply isn't tracked.
function formatSupply(med: Medication): string {
  if (!med.inventory_enabled || med.current_quantity == null) return "—";
  return `${med.current_quantity} ${med.inventory_unit}`;
}

function formatRunout(med: Medication): string {
  if (!med.inventory_enabled) return "—";
  const days = daysUntilRunout(med);
  if (days === null) return "—";
  if (days <= 0) return "Out of supply";
  return `${days} day${days === 1 ? "" : "s"}`;
}

function formatDoseChange(change: MedicationDoseChange): string {
  const from =
    change.old_dose_amount != null ? `${change.old_dose_amount}${change.old_dose_unit}` : null;
  const to = change.new_dose_amount != null ? `${change.new_dose_amount}${change.new_dose_unit}` : null;
  if (from && to) return `${from} → ${to}`;
  if (to) return `Set to ${to}`;
  if (from) return `Removed from ${from}`;
  return "—";
}

export function ExportClient() {
  const { user } = useAuth();
  const { activeProfileId, isResolving } = useActiveProfile();
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(localDateString);
  const [excludedMedicationIds, setExcludedMedicationIds] = useState<Set<string>>(new Set());
  const [includePain, setIncludePain] = useState(true);
  const [includeMood, setIncludeMood] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const generatedAt = useMemo(() => new Date().toLocaleString(), []);

  const medicationsQuery = useQuery({
    queryKey: ["medications", "active", activeProfileId],
    queryFn: () => getActiveMedications(activeProfileId),
    enabled: !isResolving,
  });
  const medications = useMemo(() => medicationsQuery.data ?? [], [medicationsQuery.data]);

  const moodSchemeQuery = useQuery({
    queryKey: ["app-settings", "mood_chart_scheme"],
    queryFn: getMoodChartScheme,
  });

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
  const allMedications = useMemo(
    () => [...medications, ...(inactiveMedicationsQuery.data ?? [])],
    [medications, inactiveMedicationsQuery.data],
  );
  const allMedicationIds = useMemo(
    () => allMedications.map((m) => m.id),
    [allMedications],
  );

  // Report scoping: fetch data for every medication regardless of
  // selection (queries above), then filter here — a checkbox toggle
  // shouldn't refetch, since the underlying data is already local.
  function toggleMedication(id: string) {
    setExcludedMedicationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const isMedicationSelected = (id: string) => !excludedMedicationIds.has(id);
  const selectedMedications = useMemo(
    () => medications.filter((m) => !excludedMedicationIds.has(m.id)),
    [medications, excludedMedicationIds],
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
  const doseLogs = (doseLogsQuery.data ?? []).filter((log) => isMedicationSelected(log.medication_id));

  const sideEffectsQuery = useQuery({
    queryKey: ["export-side-effects", startDate, endDate, allMedicationIds],
    queryFn: () => getSideEffectsInRange(startDate, endDate, allMedicationIds),
    enabled: inactiveMedicationsQuery.data !== undefined,
  });
  const sideEffects = (sideEffectsQuery.data ?? []).filter((se) =>
    isMedicationSelected(se.medication_id),
  );

  // A separate, uncapped query — doseLogs above is capped at
  // HISTORY_CAP for the display table, but adherence must reflect the
  // full selected range, not just whichever rows happen to fit under
  // that cap.
  const adherenceStatusesQuery = useQuery({
    queryKey: ["export-adherence-statuses", startDate, endDate, allMedicationIds],
    queryFn: () => getDoseLogStatusesInRange(startDate, endDate, allMedicationIds),
    enabled: inactiveMedicationsQuery.data !== undefined,
  });
  const adherenceStatuses = (adherenceStatusesQuery.data ?? []).filter((l) =>
    isMedicationSelected(l.medication_id),
  );

  // Dose change history is per-medication (not date-range scoped, per
  // spec) — fetched via the same getDoseHistory() the medication detail
  // page's DoseHistoryPanel already uses, across every medication this
  // profile has ever had (active + inactive), then filtered down to just
  // the "dose_change" entries (status events already surface elsewhere).
  const doseHistoryQueries = useQueries({
    queries: allMedicationIds.map((id) => ({
      queryKey: ["export-dose-history", id],
      queryFn: () => getDoseHistory(id),
    })),
  });
  const doseChangeGroups = allMedications
    .map((medication, i) => ({
      medication,
      changes: (doseHistoryQueries[i]?.data ?? []).filter(
        (entry): entry is Extract<DoseHistoryEntry, { type: "dose_change" }> =>
          entry.type === "dose_change",
      ),
    }))
    .filter((group) => group.changes.length > 0 && isMedicationSelected(group.medication.id));

  const allergiesQuery = useQuery({
    queryKey: ["export-allergies", activeProfileId],
    queryFn: () => getProfileAllergies(activeProfileId),
    enabled: !isResolving,
  });
  const allergies = allergiesQuery.data ?? [];

  const adherenceEligibleMeds = useMemo(
    () => selectedMedications.filter((m) => !m.as_needed && m.adherence_enabled),
    [selectedMedications],
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

  const painTrackedMeds = useMemo(
    () => (includePain ? selectedMedications.filter(medicationTracksPain) : []),
    [includePain, selectedMedications],
  );
  const moodTrackedMeds = useMemo(
    () => (includeMood ? selectedMedications.filter(medicationTracksMood) : []),
    [includeMood, selectedMedications],
  );

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
    allergiesQuery.isLoading ||
    doseHistoryQueries.some((q) => q.isLoading) ||
    painTrendQueries.some((q) => q.isLoading) ||
    moodTrendQueries.some((q) => q.isLoading);

  async function handleDownloadPdf() {
    setIsGeneratingPdf(true);
    try {
      const [{ pdf }, { DoctorVisitReportPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./DoctorVisitReportPdf"),
      ]);
      const blob = await pdf(
        <DoctorVisitReportPdf
          data={{
            patientEmail: user?.email ?? "",
            startDate,
            endDate,
            generatedAt,
            medications: selectedMedications,
            doseChangeGroups,
            doseLogs,
            historyCapped: doseLogs.length === HISTORY_CAP,
            historyCap: HISTORY_CAP,
            sideEffects,
            allergies,
            overallAdherence,
            perMedicationAdherence,
            painTrends: painTrackedMeds.map((medication, i) => ({
              medication,
              points: groupDailyAverages(painTrendQueries[i]?.data ?? []),
            })),
            moodTrends: moodTrackedMeds.map((medication, i) => ({
              medication,
              points: groupDailyAverages(moodTrendQueries[i]?.data ?? []),
            })),
          }}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `RxTracker-Doctor-Visit-Report-${startDate}-to-${endDate}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div data-no-print className="flex flex-col gap-4 rounded-card border border-brand-border bg-brand-card p-4 shadow-card">
        <div className="flex flex-wrap items-end gap-3">
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
          <label className="flex items-center gap-2 pb-2 text-sm text-brand-text">
            <Checkbox checked={includePain} onCheckedChange={(v) => setIncludePain(v === true)} />
            Include Pain Tracking
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-brand-text">
            <Checkbox checked={includeMood} onCheckedChange={(v) => setIncludeMood(v === true)} />
            Include Mood & Wellbeing
          </label>
          <Button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isLoading || isGeneratingPdf}
            className="ml-auto"
          >
            {isGeneratingPdf ? "Generating PDF…" : "Download PDF Report"}
          </Button>
        </div>

        {allMedications.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-brand-text">Medications to include</span>
              <div className="flex gap-3 text-xs text-brand-blue">
                <button type="button" onClick={() => setExcludedMedicationIds(new Set())}>
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setExcludedMedicationIds(new Set(allMedicationIds))}
                >
                  Select none
                </button>
              </div>
            </div>
            <div className="flex max-h-40 flex-wrap gap-x-4 gap-y-1.5 overflow-y-auto">
              {allMedications.map((med) => (
                <label key={med.id} className="flex items-center gap-2 text-sm text-brand-text">
                  <Checkbox
                    checked={isMedicationSelected(med.id)}
                    onCheckedChange={() => toggleMedication(med.id)}
                  />
                  {med.name}
                  {!med.active && <span className="text-xs text-brand-text-muted">(inactive)</span>}
                </label>
              ))}
            </div>
          </div>
        )}
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
            {/* 1. Active medications */}
            <section data-report-section>
              <h2 className="mb-3 text-lg font-bold text-brand-navy">Active medications</h2>
              {selectedMedications.length === 0 ? (
                <p className="text-sm text-brand-text-muted">No medications selected for this report.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-brand-border text-left text-xs text-brand-text-muted">
                        <th className="py-1.5 pr-3 font-medium">Name</th>
                        <th className="py-1.5 pr-3 font-medium">Dose</th>
                        <th className="py-1.5 pr-3 font-medium">Schedule</th>
                        <th className="py-1.5 pr-3 font-medium">Instructions</th>
                        <th className="py-1.5 pr-3 font-medium">Current supply</th>
                        <th className="py-1.5 pr-3 font-medium">Days until runout</th>
                        <th className="py-1.5 font-medium">Start date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedMedications.map((med) => (
                        <tr key={med.id} className="border-b border-brand-border align-top">
                          <td className="py-1.5 pr-3 font-medium text-brand-text">{med.name}</td>
                          <td className="py-1.5 pr-3 text-brand-text-muted">{med.dose || "—"}</td>
                          <td className="py-1.5 pr-3 text-brand-text-muted">
                            {formatSchedule(med)}
                          </td>
                          <td className="py-1.5 pr-3 text-brand-text-muted">
                            {med.instructions || "—"}
                          </td>
                          <td className="py-1.5 pr-3 text-brand-text-muted">
                            {formatSupply(med)}
                          </td>
                          <td className="py-1.5 pr-3 text-brand-text-muted">
                            {formatRunout(med)}
                          </td>
                          <td className="py-1.5 text-brand-text-muted">
                            {med.start_date ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* 2. Dose change history, per medication */}
            <section data-report-section>
              <h2 className="mb-3 text-lg font-bold text-brand-navy">Dose change history</h2>
              {doseChangeGroups.length === 0 ? (
                <p className="text-sm text-brand-text-muted">No dose changes recorded.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {doseChangeGroups.map(({ medication, changes }) => (
                    <div key={medication.id}>
                      <h3 className="mb-1.5 text-sm font-semibold text-brand-text">
                        {medication.name}
                      </h3>
                      <ul className="flex flex-col gap-1">
                        {changes.map((change) => (
                          <li key={change.data.id} className="text-sm text-brand-text-muted">
                            <span className="text-brand-text">
                              {new Date(change.at).toLocaleDateString()}
                            </span>
                            {" — "}
                            {formatDoseChange(change.data)}
                            {change.data.comment && ` (${change.data.comment})`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 3. Dose history — last HISTORY_CAP logs, with pain/mood/notes */}
            <section data-report-section>
              <h2 className="mb-3 text-lg font-bold text-brand-navy">Dose history</h2>
              {doseLogs.length === 0 ? (
                <p className="text-sm text-brand-text-muted">No doses logged for this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-brand-border text-left text-xs text-brand-text-muted">
                        <th className="py-1.5 pr-3 font-medium">Date</th>
                        <th className="py-1.5 pr-3 font-medium">Medication</th>
                        <th className="py-1.5 pr-3 font-medium">Time</th>
                        <th className="py-1.5 pr-3 font-medium">Status</th>
                        <th className="py-1.5 pr-3 font-medium">Pain</th>
                        <th className="py-1.5 pr-3 font-medium">Mood</th>
                        <th className="py-1.5 font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doseLogs.map((log) => (
                        <tr key={log.id} className="border-b border-brand-border align-top">
                          <td className="py-1.5 pr-3 text-brand-text-muted">
                            {log.scheduled_for_date}
                          </td>
                          <td className="py-1.5 pr-3 text-brand-text">{log.medications.name}</td>
                          <td className="py-1.5 pr-3 text-brand-text-muted">
                            {to12h(log.scheduled_time.slice(0, 5))}
                          </td>
                          <td className="py-1.5 pr-3">
                            <Badge variant={log.status === "taken" ? "taken" : log.status} />
                          </td>
                          <td className="py-1.5 pr-3 text-brand-text-muted">
                            {log.pain_level ?? "—"}
                          </td>
                          <td className="py-1.5 pr-3 text-brand-text-muted">
                            {log.mood_level ?? "—"}
                          </td>
                          <td className="py-1.5 text-brand-text-muted">{log.note || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {doseLogs.length === HISTORY_CAP && (
                <p className="mt-2 text-xs text-brand-text-muted">
                  Showing the most recent {HISTORY_CAP} entries for this period.
                </p>
              )}
            </section>

            {/* 4. Side effects */}
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

            {/* 5. Allergies */}
            <section data-report-section>
              <h2 className="mb-3 text-lg font-bold text-brand-navy">Allergies</h2>
              {allergies.length === 0 ? (
                <p className="text-sm text-brand-text-muted">No allergies recorded.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {allergies.map((a) => (
                    <li key={a.id} className="text-sm">
                      <span className="font-medium text-brand-text">{a.name}</span>
                      {!a.is_active && (
                        <span className="ml-2 text-xs text-brand-text-muted">(inactive)</span>
                      )}
                      <span className="text-brand-text-muted">
                        {" — "}
                        {a.allergy_type === "allergy" ? "Allergy" : "Intolerance"}
                        {a.life_threatening
                          ? " · Life-threatening"
                          : a.severity && ` · ${ALLERGY_SEVERITY_LABELS[a.severity]}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Value-adds beyond the spec'd sections — kept, placed after them */}
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
                <ReportTrendChart
                  metric="mood"
                  points={moodTrendQueries[i]?.data ?? []}
                  moodChartScheme={moodSchemeQuery.data}
                />
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
