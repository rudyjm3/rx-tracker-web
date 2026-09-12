import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { FeedbackChip, feedbackChipTypes } from "@/components/ui/FeedbackChip";
import { MedTypeBadge } from "@/components/ui/MedTypeBadge";
import { formatMedicationNameDose } from "@/lib/medication-label";
import { formatLongDate, formatShortDate, to12h } from "@/lib/utils";
import type { Medication } from "@/lib/types/medications";
import type { DoctorVisitReportData, TrendNoteEntry } from "./DoctorVisitReportPdf";
import { ReportAdherenceRing } from "./ReportAdherenceRing";
import { ReportTrendChart } from "./ReportTrendChart";

function formatSchedule(med: Medication): string {
  if (med.as_needed) return "As needed";
  if (med.schedule_mode === "interval" && med.interval_hours && med.first_dose_time) {
    return `Every ${med.interval_hours}h from ${to12h(med.first_dose_time.slice(0, 5))}`;
  }
  const times = med.medication_schedule_times ?? [];
  if (times.length === 0) return "—";
  return times.map((t) => to12h(t.reminder_time.slice(0, 5))).join(", ");
}

// Name first, badges/chips on their own row below — a long medication
// name no longer wraps awkwardly around leading badges when it's given
// the full row width to itself.
function MedicationLabel({
  medication,
  suffix: _suffix,
  annotation,
  includeDose = true,
}: {
  medication: Medication;
  suffix?: string;
  annotation?: string | null;
  includeDose?: boolean;
}) {
  void _suffix;

  return (
    <div>
      <span className="text-sm font-semibold text-brand-text">
        {includeDose ? formatMedicationNameDose(medication) : medication.name}
      </span>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <MedTypeBadge type={medication.medication_type} />
        {feedbackChipTypes(medication.feedback_type).map((t) => (
          <FeedbackChip key={t} type={t} />
        ))}
      </div>
      {annotation && <p className="mt-0.5 text-xs text-brand-text-muted">{annotation}</p>}
    </div>
  );
}

function ReportSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section data-report-section className="border-b border-brand-border px-6 py-6 last:border-b-0">
      <h2 className="text-base font-bold text-brand-navy">{title}</h2>
      {description && <p className="mt-1 text-xs text-brand-text-muted">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

interface Column<T> {
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

function ReportTable<T>({
  columns,
  rows,
  emptyLabel,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  emptyLabel: string;
  rowKey: (row: T, i: number) => string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm italic text-brand-text-muted">{emptyLabel}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-control border border-brand-border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="bg-brand-bg text-left text-xs uppercase text-brand-text-muted">
            {columns.map((col) => (
              <th key={col.header} className={`px-3 py-2 font-semibold ${col.className ?? ""}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)} className="border-t border-brand-border align-top">
              {columns.map((col) => (
                <td key={col.header} className={`px-3 py-2 text-brand-text-muted ${col.className ?? ""}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex h-[90px] flex-1 flex-col overflow-hidden rounded-control bg-brand-bg">
      <div className="flex flex-1 items-center justify-center">
        <span className="text-xl font-bold" style={color ? { color } : undefined}>
          {value}
        </span>
      </div>
      <div className="bg-brand-border px-1 py-1.5">
        <span className="block text-center text-[10px] uppercase tracking-wide text-brand-navy">
          {label}
        </span>
      </div>
    </div>
  );
}

function adherenceColor(percent: number): string {
  if (percent >= 80) return "var(--color-status-success)";
  if (percent >= 50) return "var(--color-status-warning)";
  return "var(--color-status-danger)";
}

function PatientNotesList({ notes }: { notes: TrendNoteEntry[] }) {
  if (notes.length === 0) return null;
  const byDate = new Map<string, TrendNoteEntry[]>();
  for (const n of notes) {
    const list = byDate.get(n.date) ?? [];
    list.push(n);
    byDate.set(n.date, list);
  }
  const dates = Array.from(byDate.keys()).sort();
  return (
    <div className="mt-3 text-sm">
      <p className="mb-1.5 font-semibold text-brand-text">Patient notes:</p>
      <div className="flex flex-col gap-2">
        {dates.map((date) => (
          <div key={date}>
            <p className="text-xs font-semibold text-brand-navy">{formatLongDate(date)}</p>
            {byDate.get(date)!.map((n, i) => (
              <p key={i} className="text-xs text-brand-text-muted">
                <span className="text-brand-text">{to12h(n.time)}</span>{" "}
                <span>
                  ({n.source} — {n.medicationName}):
                </span>{" "}
                {n.note}
                {n.editedAt && (
                  <span className="italic"> [edited {formatLongDate(n.editedAt.slice(0, 10))}]</span>
                )}
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportSummary({ data }: { data: DoctorVisitReportData }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-brand-border bg-brand-card shadow-card">
      <header
        data-report-section
        className="flex items-center gap-4 bg-gradient-brand-dark px-6 py-6 text-white"
      >
        <Image
          src="/icons/icon-512.png"
          alt=""
          width={48}
          height={48}
          className="rounded-xl"
          aria-hidden="true"
        />
        <div>
          <h1 className="text-xl font-bold">Doctor Visit Report</h1>
          <p className="mt-1 text-sm text-white/85">Prepared by RxTracker • Patient: {data.patientName}</p>
          <p className="text-sm text-white/85">
            Reporting period: {formatShortDate(data.startDate)} – {formatShortDate(data.endDate)} • Generated:{" "}
            {data.generatedAt}
          </p>
        </div>
      </header>

      <ReportSection title="Known Allergies & Intolerances">
        <ReportTable
          rowKey={(a) => a.id}
          columns={[
            { header: "Substance", render: (a) => <span className="text-brand-text">{a.name}</span> },
            {
              header: "Type",
              render: (a) => (a.allergy_type === "allergy" ? "Allergy" : "Intolerance"),
            },
          ]}
          rows={data.allergies}
          emptyLabel="No allergies recorded."
        />
      </ReportSection>

      <ReportSection title="Adherence Summary">
        <div className="flex flex-wrap items-stretch gap-3">
          <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-control bg-brand-bg px-3 py-3">
            <ReportAdherenceRing percent={data.overallAdherencePercent} />
            <span className="text-center text-[10px] uppercase tracking-wide text-brand-text-muted">
              Overall adherence
            </span>
          </div>
          <StatTile label="Doses scheduled" value={String(data.dosesScheduled)} />
          <StatTile
            label="Doses taken"
            value={String(data.dosesTaken)}
            color="var(--color-status-success)"
          />
          <StatTile
            label="Doses missed"
            value={String(data.dosesMissed)}
            color="var(--color-status-danger)"
          />
          <StatTile
            label="Doses skipped"
            value={String(data.dosesSkipped)}
            color="var(--color-status-warning)"
          />
        </div>
        {data.adherenceBreakout.length > 0 && (
          <>
            <p className="mb-2 mt-4 text-xs text-brand-text-muted">
              Adherence by medication is broken out below where rates differ from the overall average.
            </p>
            <ReportTable
              rowKey={(r) => r.medication.id}
              columns={[
                {
                  header: "Medication",
                  render: (r) => <MedicationLabel medication={r.medication} suffix={`– ${r.medication.dose}`} />,
                },
                {
                  header: "Adherence",
                  render: (r) => (
                    <span className="font-semibold" style={{ color: adherenceColor(r.percent) }}>
                      {r.percent}%
                    </span>
                  ),
                },
                { header: "Missed", render: (r) => `${r.missed} of ${r.scheduled}` },
              ]}
              rows={data.adherenceBreakout}
              emptyLabel=""
            />
          </>
        )}
      </ReportSection>

      <ReportSection title="Current Medications">
        <ReportTable
          rowKey={(r) => r.medication.id}
          columns={[
            {
              header: "Medication",
              render: (r) => (
                <MedicationLabel
                  medication={r.medication}
                  includeDose={false}
                  annotation={r.resumedOn ? `(Resumed use on ${r.resumedOn})` : null}
                />
              ),
            },
            { header: "Dose", render: (r) => r.medication.dose },
            {
              header: "Start Date",
              render: (r) => (r.medication.start_date ? formatShortDate(r.medication.start_date) : "—"),
            },
            { header: "Schedule", render: (r) => formatSchedule(r.medication) },
            { header: "Instructions", render: (r) => r.medication.instructions || "—" },
          ]}
          rows={data.currentMedications}
          emptyLabel="No medications selected for this report."
        />
      </ReportSection>

      <ReportSection
        title="Reported Side Effects"
        description="Patient-logged side effects for the reporting period, most recent first."
      >
        <ReportTable
          rowKey={(se) => se.id}
          columns={[
            { header: "Date", render: (se) => formatShortDate(se.occurred_date) },
            { header: "Medication", render: (se) => formatMedicationNameDose(se.medications) },
            { header: "Severity", render: (se) => se.severity },
            { header: "Side Effect", render: (se) => se.description },
            { header: "Notes", render: (se) => se.note || "—" },
          ]}
          rows={data.sideEffects}
          emptyLabel="No side effects logged for this period."
        />
      </ReportSection>

      <ReportSection
        title="Discontinued Medications"
        description="Medications the patient has stopped using, with the reason and notes recorded when use was discontinued."
      >
        <ReportTable
          rowKey={(r) => r.medication.id}
          columns={[
            { header: "Medication", render: (r) => <MedicationLabel medication={r.medication} includeDose={false} /> },
            { header: "Dose", render: (r) => r.medication.dose },
            { header: "Reason", render: (r) => r.event?.reason || "—" },
            { header: "Notes", render: (r) => r.event?.comment || "—" },
            {
              header: "Date Discontinued",
              render: (r) => (r.event ? formatShortDate(r.event.event_at.slice(0, 10)) : "—"),
            },
          ]}
          rows={data.discontinuedMedications}
          emptyLabel="No discontinued medications for this profile."
        />
      </ReportSection>

      <ReportSection title="Dose Changes">
        <ReportTable
          rowKey={(r) => r.data.id}
          columns={[
            { header: "Date", render: (r) => formatShortDate(r.at.slice(0, 10)) },
            { header: "Medication", render: (r) => formatMedicationNameDose(r.medication) },
            {
              header: "Change",
              render: (r) => {
                const from =
                  r.data.old_dose_amount != null ? `${r.data.old_dose_amount}${r.data.old_dose_unit}` : null;
                const to =
                  r.data.new_dose_amount != null ? `${r.data.new_dose_amount}${r.data.new_dose_unit}` : null;
                if (from && to) return `${from} → ${to}`;
                if (to) return `Set to ${to}`;
                if (from) return `Removed from ${from}`;
                return "—";
              },
            },
            { header: "Comment", render: (r) => r.data.comment || "—" },
          ]}
          rows={data.doseChanges}
          emptyLabel="No dose changes recorded during this period."
        />
      </ReportSection>

      <ReportSection
        title="Missed Dose Detail"
        description="Showing missed and skipped doses for the reporting period, most recent first."
      >
        <ReportTable
          rowKey={(l) => l.id}
          columns={[
            { header: "Date", render: (l) => formatShortDate(l.scheduled_for_date) },
            { header: "Medication", render: (l) => formatMedicationNameDose(l.medications) },
            { header: "Scheduled Time", render: (l) => to12h(l.scheduled_time.slice(0, 5)) },
            { header: "Status", render: (l) => <Badge variant={l.status} /> },
          ]}
          rows={data.missedDoseDetail}
          emptyLabel="No missed or skipped doses for this period."
        />
        {data.missedDoseDetailTotal > data.missedDoseDetail.length && (
          <p className="mt-2 text-xs italic text-brand-text-muted">
            {`+ ${data.missedDoseDetailTotal - data.missedDoseDetail.length} additional missed/skipped doses in this period (full list available in app).`}
          </p>
        )}
      </ReportSection>

      {data.painTrends.length > 0 && (
        <ReportSection
          title="Pain Level Tracking"
          description="Recorded after doses and as standalone logs for medications with pain tracking enabled. Chart shows daily pain level (1–10) over the reporting period. Hollow circles indicate standalone log entries."
        >
          <div className="flex flex-col gap-6">
            {data.painTrends.map(({ medication, points, notes }) => {
              const avg = points.length
                ? (points.reduce((sum, p) => sum + p.level, 0) / points.length).toFixed(1)
                : "—";
              return (
                <div key={medication.id}>
                  <MedicationLabel medication={medication} />
                  <p className="mb-2 mt-1 text-xs text-brand-text-muted">
                    {`Reporting period: ${formatShortDate(data.startDate)} – ${formatShortDate(data.endDate)}  |  Avg pain: ${avg}/10  |  Days logged: ${points.length}`}
                  </p>
                  <ReportTrendChart metric="pain" dailyAverages={points} />
                  <PatientNotesList notes={notes} />
                </div>
              );
            })}
          </div>
        </ReportSection>
      )}

      {data.moodTrends.length > 0 && (
        <ReportSection
          title="Mood & Wellbeing Tracking"
          description="Recorded after doses and as standalone logs for medications with mood tracking enabled. Chart shows daily mood level (1–10) over the reporting period. Hollow circles indicate standalone log entries."
        >
          <div className="flex flex-col gap-6">
            {data.moodTrends.map(({ medication, points, notes }) => {
              const avg = points.length
                ? (points.reduce((sum, p) => sum + p.level, 0) / points.length).toFixed(1)
                : "—";
              return (
                <div key={medication.id}>
                  <MedicationLabel medication={medication} />
                  <p className="mb-2 mt-1 text-xs text-brand-text-muted">
                    {`Reporting period: ${formatShortDate(data.startDate)} – ${formatShortDate(data.endDate)}  |  Avg mood: ${avg}/10  |  Days logged: ${points.length}`}
                  </p>
                  <ReportTrendChart metric="mood" dailyAverages={points} moodChartScheme={data.moodChartScheme} />
                  <PatientNotesList notes={notes} />
                </div>
              );
            })}
          </div>
        </ReportSection>
      )}

      <footer className="border-t border-brand-border px-6 py-4">
        <p className="text-xs text-brand-text-muted">
          RxTracker is a self-tracking aid and does not provide medical advice or clinical decision support. This
          report reflects patient-logged data only and has not been independently verified. Always consult your
          healthcare provider.
        </p>
        <p className="mt-1 text-xs text-brand-text-muted">Generated {data.generatedAt}</p>
      </footer>
    </div>
  );
}
