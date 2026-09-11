"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { CheckCircle2, FileDown } from "lucide-react";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { useAuth } from "@/components/layout/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { Checkbox } from "@/components/ui/Checkbox";
import { Switch } from "@/components/ui/Switch";
import { computeAdherence } from "@/lib/adherence";
import { getProfileAllergies } from "@/lib/allergies";
import { getMoodChartScheme } from "@/lib/app-settings";
import { getDoseLogHistory, getDoseLogStatusesInRange } from "@/lib/dose-logs";
import {
  getActiveMedications,
  getDoseHistory,
  getInactiveMedications,
  type DoseHistoryEntry,
} from "@/lib/medications";
import {
  getTrend,
  groupDailyAverages,
  medicationTracksMood,
  medicationTracksPain,
  type TrendPoint,
} from "@/lib/pain-mood";
import { getSideEffectsInRange } from "@/lib/side-effects";
import { getUserProfile } from "@/lib/user-profile";
import { daysOnMedication, formatLongDate, localDateString } from "@/lib/utils";
import type { MedicationStatusEvent, StatusEventType } from "@/lib/types/medications";
import type { DoctorVisitReportData, TrendNoteEntry } from "./DoctorVisitReportPdf";
import { ReportSummary } from "./ReportSummary";

const HISTORY_CAP = 500;
const MISSED_DOSE_DISPLAY_CAP = 25;

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return localDateString(d);
}

function latestStatusEvent(
  entries: DoseHistoryEntry[],
  event: StatusEventType,
): MedicationStatusEvent | null {
  const matches = entries.filter(
    (e): e is Extract<DoseHistoryEntry, { type: "status_event" }> =>
      e.type === "status_event" && e.data.event === event,
  );
  if (matches.length === 0) return null;
  return matches.reduce((latest, cur) => (cur.at > latest.at ? cur : latest)).data;
}

export function ExportClient() {
  const { user } = useAuth();
  const { activeProfileId, activeProfile, isResolving } = useActiveProfile();
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(localDateString);
  const [excludedMedicationIds, setExcludedMedicationIds] = useState<Set<string>>(new Set());
  const [includePain, setIncludePain] = useState(true);
  const [includeMood, setIncludeMood] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const generatedAt = useMemo(() => new Date().toLocaleString(), []);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
    // Only revoke on unmount — pdfUrl changes are handled explicitly
    // (the previous URL is revoked right before a new one replaces it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const userProfileQuery = useQuery({
    queryKey: ["user-profile"],
    queryFn: getUserProfile,
    enabled: !isResolving && activeProfileId === null,
  });
  const patientName = activeProfile
    ? activeProfile.display_name
    : (() => {
        const p = userProfileQuery.data;
        const fullName = [p?.first_name, p?.last_name].filter(Boolean).join(" ");
        return fullName || p?.display_name || user?.email?.split("@")[0] || "";
      })();

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

  // Dose history (dose changes + discontinued/resumed status events) is
  // per-medication (not date-range scoped) — fetched via the same
  // getDoseHistory() the medication detail page's DoseHistoryPanel
  // already uses, across every medication this profile has ever had.
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
  const doseChanges = doseChangeGroups
    .flatMap((group) => group.changes.map((change) => ({ ...change, medication: group.medication })))
    .sort((a, b) => b.at.localeCompare(a.at));

  const currentMedications = selectedMedications.map((medication) => {
    const entries = doseHistoryQueries[allMedications.indexOf(medication)]?.data ?? [];
    const resumed = latestStatusEvent(entries, "resumed");
    return {
      medication,
      resumedOn: resumed ? formatLongDate(resumed.event_at.slice(0, 10)) : null,
    };
  });
  const discontinuedMedications = allMedications
    .filter((m) => !m.active && isMedicationSelected(m.id))
    .map((medication) => {
      const entries = doseHistoryQueries[allMedications.indexOf(medication)]?.data ?? [];
      return { medication, event: latestStatusEvent(entries, "discontinued") };
    });

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
  const eligibleStatuses = adherenceStatuses.filter((l) => eligibleIds.has(l.medication_id));
  const overallAdherence = computeAdherence(eligibleStatuses);
  const dosesScheduled = eligibleStatuses.length;
  const dosesTaken = eligibleStatuses.filter((l) => l.status === "taken").length;
  const dosesMissed = eligibleStatuses.filter((l) => l.status === "missed").length;
  const dosesSkipped = eligibleStatuses.filter((l) => l.status === "skipped").length;
  const adherenceBreakout = adherenceEligibleMeds
    .map((med) => {
      const logs = adherenceStatuses.filter((l) => l.medication_id === med.id);
      return {
        medication: med,
        percent: computeAdherence(logs),
        scheduled: logs.length,
        missed: logs.filter((l) => l.status !== "taken").length,
      };
    })
    .filter((r) => r.percent !== overallAdherence);

  const missedDoseDetailAll = [...doseLogs]
    .filter((l) => l.status !== "taken")
    .sort((a, b) => `${b.scheduled_for_date}T${b.scheduled_time}`.localeCompare(`${a.scheduled_for_date}T${a.scheduled_time}`));
  const missedDoseDetail = missedDoseDetailAll.slice(0, MISSED_DOSE_DISPLAY_CAP);

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

  function buildNotes(medicationName: string, points: TrendPoint[]): TrendNoteEntry[] {
    return points
      .filter((p) => p.note.trim().length > 0)
      .map((p) => ({
        date: p.date,
        time: p.time,
        source: p.source,
        medicationName,
        note: p.note,
        editedAt: p.editedAt,
      }))
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  }

  const painTrends = painTrackedMeds.map((medication, i) => {
    const raw = painTrendQueries[i]?.data ?? [];
    return { medication, points: groupDailyAverages(raw), notes: buildNotes(medication.name, raw) };
  });
  const moodTrends = moodTrackedMeds.map((medication, i) => {
    const raw = moodTrendQueries[i]?.data ?? [];
    return { medication, points: groupDailyAverages(raw), notes: buildNotes(medication.name, raw) };
  });

  const isLoading =
    isResolving ||
    medicationsQuery.isLoading ||
    inactiveMedicationsQuery.isLoading ||
    doseLogsQuery.isLoading ||
    sideEffectsQuery.isLoading ||
    adherenceStatusesQuery.isLoading ||
    allergiesQuery.isLoading ||
    (activeProfileId === null && userProfileQuery.isLoading) ||
    doseHistoryQueries.some((q) => q.isLoading) ||
    painTrendQueries.some((q) => q.isLoading) ||
    moodTrendQueries.some((q) => q.isLoading);

  const reportData: DoctorVisitReportData = {
    patientName,
    startDate,
    endDate,
    generatedAt,
    allergies,
    overallAdherencePercent: overallAdherence,
    dosesScheduled,
    dosesTaken,
    dosesMissed,
    dosesSkipped,
    adherenceBreakout,
    currentMedications,
    sideEffects,
    discontinuedMedications,
    doseChanges,
    missedDoseDetail,
    missedDoseDetailTotal: missedDoseDetailAll.length,
    painTrends,
    moodTrends,
    moodChartScheme: moodSchemeQuery.data,
  };

  async function handleDownloadPdf() {
    setIsGeneratingPdf(true);
    try {
      const [{ pdf }, { DoctorVisitReportPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./DoctorVisitReportPdf"),
      ]);
      const blob = await pdf(<DoctorVisitReportPdf data={reportData} />).toBlob();
      const url = URL.createObjectURL(blob);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      const toFilenameDate = (isoDate: string) => {
        const [y, m, d] = isoDate.split("-");
        return `${m}-${d}-${y}`;
      };
      const link = document.createElement("a");
      link.href = url;
      link.download = `RxTracker-Doctor-Visit-Report-${toFilenameDate(startDate)}-to-${toFilenameDate(endDate)}.pdf`;
      link.click();
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div data-no-print className="rounded-card border border-brand-border bg-brand-card p-6 shadow-card">
        <h2 className="text-lg font-bold text-brand-navy">Reporting Period</h2>
        <p className="mt-1 text-sm text-brand-text-muted">Used for the report below.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
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
        </div>
      </div>

      <div data-no-print className="rounded-card border border-brand-border bg-brand-card p-6 shadow-card">
        <h2 className="text-lg font-bold text-brand-navy">Doctor Visit Report</h2>
        <p className="mt-1 text-sm text-brand-text-muted">
          Generate a branded PDF summary of your medication history, adherence, pain trends, side effects, and
          (optionally) mood trends — ready to share with your doctor.
        </p>

        <div className="mt-5 flex flex-col gap-4">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-brand-text">Include Pain tracking</span>
            <Switch checked={includePain} onCheckedChange={setIncludePain} />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-brand-text">Include Mood &amp; Wellbeing tracking</span>
            <Switch checked={includeMood} onCheckedChange={setIncludeMood} />
          </label>
        </div>

        {includePain && (
          <div className="mt-4 rounded-control border border-brand-border p-3">
            <p className="mb-2 text-sm font-semibold text-brand-navy">Pain-tracked medications</p>
            {painTrackedMeds.length === 0 ? (
              <p className="text-sm text-brand-text-muted">No pain-tracked medications selected.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {painTrackedMeds.map((med) => (
                  <li
                    key={med.id}
                    className="flex items-center justify-between rounded-control bg-brand-bg px-3 py-2 text-sm"
                  >
                    <span className="font-semibold text-brand-text">{med.name}</span>
                    <span className="text-brand-text-muted">
                      {daysOnMedication(med.start_date, endDate) ?? "—"} days on medication
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {includeMood && (
          <div className="mt-4 rounded-control border border-brand-border p-3">
            <p className="mb-2 text-sm font-semibold text-brand-navy">Mood-tracked medications</p>
            {moodTrackedMeds.length === 0 ? (
              <p className="text-sm text-brand-text-muted">No mood-tracked medications selected.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {moodTrackedMeds.map((med) => (
                  <li
                    key={med.id}
                    className="flex items-center justify-between rounded-control bg-brand-bg px-3 py-2 text-sm"
                  >
                    <span className="font-semibold text-brand-text">{med.name}</span>
                    <span className="text-brand-text-muted">
                      {daysOnMedication(med.start_date, endDate) ?? "—"} days on medication
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {allMedications.length > 0 && (
          <div className="mt-4">
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

        <Button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isLoading || isGeneratingPdf}
          className="mt-5 w-full justify-center gap-2 sm:w-auto"
        >
          <FileDown size={16} />
          {isGeneratingPdf ? "Generating PDF…" : "Generate & Download PDF"}
        </Button>

        {pdfUrl && !isGeneratingPdf && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-control border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              Your PDF is downloading — check your Downloads folder.
            </span>
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
              Open PDF
            </a>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-brand-text-muted">Loading report…</p>
      ) : (
        <ReportSummary data={reportData} />
      )}
    </div>
  );
}
