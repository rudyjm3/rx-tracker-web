import type { ReactNode } from "react";
import {
  Circle,
  Document,
  G,
  Image,
  Page,
  Path,
  Polyline,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import type { MoodChartScheme } from "@/lib/app-settings";
import type { CalendarLogRow } from "@/lib/dose-logs";
import type { DoseHistoryEntry } from "@/lib/medications";
import { levelColor, type DailyAverage, type WellbeingMetric } from "@/lib/pain-mood";
import type { SideEffectRow } from "@/lib/side-effects";
import type { ProfileAllergyWithName } from "@/lib/types/profile";
import { formatLongDate, formatShortDate, to12h } from "@/lib/utils";
import type { FeedbackType, Medication, MedicationStatusEvent } from "@/lib/types/medications";

type DoseChangeEntry = Extract<DoseHistoryEntry, { type: "dose_change" }>;

const NAVY = "#102b57";
const DARK_NAVY = "#071d3d";
const BLUE = "#0a8ac8";
const CYAN = "#14cfe0";
const TEXT = "#172033";
const MUTED = "#60708a";
const BORDER = "#d7e6f8";
const SUCCESS = "#18bfa6";
const WARNING = "#f5a524";
const DANGER = "#e5484d";
const PURPLE = "#8b5cf6";
const CARD_BG = "#f6faff";

const MED_TYPE_STYLES: Record<Medication["medication_type"], { bg: string; color: string; label: string }> = {
  prescription: { bg: "#0754a81a", color: "#0754a8", label: "Rx" },
  otc: { bg: "#0a8ac81a", color: BLUE, label: "OTC" },
  supplement: { bg: "#f5a5241a", color: WARNING, label: "Supplement" },
};

const styles = StyleSheet.create({
  // Bottom padding lives on the Page (not the nested `body` View) so it's
  // reserved on every physical page — a View's own padding only applies to
  // the first/last fragment when its content wraps across pages, which let
  // the last row of a long table on an interior page render underneath the
  // fixed footer's disclaimer text instead of stopping above it. The value
  // must clear the footer's full height (border + two lines of text,
  // positioned at bottom:20).
  page: { padding: 0, paddingBottom: 85, fontSize: 9, color: TEXT, fontFamily: "Helvetica" },
  body: { padding: "0 32 0 32" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: DARK_NAVY,
    padding: "24 32",
    marginBottom: 20,
  },
  logo: { width: 48, height: 48, borderRadius: 12 },
  title: { fontSize: 20, fontWeight: 700, color: "#ffffff" },
  subtitle: { fontSize: 9.5, color: "#cfe6f7", marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12.5, fontWeight: 700, color: NAVY, marginBottom: 4 },
  sectionDesc: { fontSize: 8.5, color: MUTED, marginBottom: 8, lineHeight: 1.4 },
  emptyText: { fontSize: 9, color: MUTED, fontStyle: "italic" },
  table: { borderTop: `1pt solid ${BORDER}`, borderRadius: 4, overflow: "hidden" },
  tableRow: { flexDirection: "row", borderBottom: `1pt solid ${BORDER}`, paddingVertical: 6, paddingHorizontal: 8 },
  tableHeaderRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: CARD_BG,
  },
  th: { fontSize: 7.5, fontWeight: 700, color: MUTED, textTransform: "uppercase" },
  td: { fontSize: 8.5, color: TEXT },
  tdMuted: { fontSize: 8.5, color: MUTED },
  medBadge: {
    fontSize: 7,
    fontWeight: 700,
    textTransform: "uppercase",
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 3,
    marginRight: 4,
  },
  chip: {
    fontSize: 6.5,
    fontWeight: 700,
    textTransform: "uppercase",
    paddingHorizontal: 3.5,
    paddingVertical: 1.5,
    borderRadius: 3,
    borderWidth: 1,
    marginRight: 3,
  },
  statRow: { flexDirection: "row", gap: 10 },
  statTile: {
    flex: 1,
    height: 90,
    backgroundColor: CARD_BG,
    borderRadius: 8,
    overflow: "hidden",
  },
  statValueWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  statLabelBar: { backgroundColor: BORDER, paddingVertical: 4 },
  statLabel: { fontSize: 6.5, color: NAVY, textTransform: "uppercase", textAlign: "center" },
  statValue: { fontSize: 16, fontWeight: 700 },
  chartWrap: { marginTop: 4 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    borderTop: `1pt solid ${BORDER}`,
    paddingTop: 8,
  },
});

function MedTypeBadgePdf({ type }: { type: Medication["medication_type"] }) {
  const s = MED_TYPE_STYLES[type];
  return (
    <Text style={[styles.medBadge, { backgroundColor: s.bg, color: s.color }]}>{s.label}</Text>
  );
}

function FeedbackChipsPdf({ feedbackType }: { feedbackType: FeedbackType }) {
  const chips: { label: string; color: string }[] = [];
  if (feedbackType === "pain" || feedbackType === "both") chips.push({ label: "Pain", color: WARNING });
  if (feedbackType === "mood" || feedbackType === "both") chips.push({ label: "Mood", color: PURPLE });
  if (chips.length === 0) return null;
  return (
    <>
      {chips.map((c) => (
        <Text key={c.label} style={[styles.chip, { borderColor: c.color, color: c.color }]}>
          {c.label}
        </Text>
      ))}
    </>
  );
}

// Name first, badges/chips on their own row below — a long medication
// name (e.g. a combo OTC product) no longer wraps awkwardly around
// leading badges when it's given the full row width to itself.
function MedicationLabel({
  medication,
  suffix,
  annotation,
}: {
  medication: Medication;
  suffix?: string;
  annotation?: string | null;
}) {
  return (
    <View>
      <Text style={{ fontSize: 8.5, fontWeight: 700, color: TEXT }}>
        {medication.name}
        {suffix ? ` ${suffix}` : ""}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
        <MedTypeBadgePdf type={medication.medication_type} />
        <FeedbackChipsPdf feedbackType={medication.feedback_type} />
      </View>
      {annotation && <Text style={{ fontSize: 7, color: MUTED, marginTop: 1 }}>{annotation}</Text>}
    </View>
  );
}

interface Column<T> {
  header: string;
  flex: number;
  render: (row: T) => ReactNode;
}

function PdfTable<T>({ columns, rows, emptyLabel }: { columns: Column<T>[]; rows: T[]; emptyLabel: string }) {
  if (rows.length === 0) {
    return <Text style={styles.emptyText}>{emptyLabel}</Text>;
  }
  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow}>
        {columns.map((col) => (
          <View key={col.header} style={{ flex: col.flex, paddingRight: 4 }}>
            <Text style={styles.th}>{col.header}</Text>
          </View>
        ))}
      </View>
      {rows.map((row, i) => (
        <View key={i} style={styles.tableRow} wrap={false}>
          {columns.map((col) => {
            const value = col.render(row);
            return (
              <View key={col.header} style={{ flex: col.flex, paddingRight: 4 }}>
                {typeof value === "string" || typeof value === "number" ? (
                  <Text style={styles.td}>{value || "—"}</Text>
                ) : (
                  value
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function StatTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statValueWrap}>
        <Text style={[styles.statValue, { color: color ?? TEXT }]}>{value}</Text>
      </View>
      <View style={styles.statLabelBar}>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

// react-pdf's SVG layer doesn't implement strokeDashoffset (only
// strokeDasharray, which alone can't express a *partial* sweep), so
// the progress ring is drawn as an actual arc <Path> instead of the
// stroke-dash trick the web version (ReportAdherenceRing.tsx) uses.
function ringArcPath(cx: number, cy: number, r: number, percent: number): string | null {
  if (percent <= 0) return null;
  const sweep = Math.min(percent, 99.99) * 3.6;
  const start = polarPoint(cx, cy, r, 0);
  const end = polarPoint(cx, cy, r, sweep);
  const largeArcFlag = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function AdherenceRingPdf({ percent }: { percent: number }) {
  const size = 64;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const color = percent >= 80 ? SUCCESS : percent >= 50 ? WARNING : DANGER;
  const center = size / 2;
  const arc = ringArcPath(center, center, radius, percent);
  return (
    <View
      style={[
        styles.statTile,
        { flex: 1.3, alignItems: "center", justifyContent: "center", padding: 6 },
      ]}
    >
      <Svg width={size} height={size}>
        <Circle cx={center} cy={center} r={radius} stroke={BORDER} strokeWidth={strokeWidth} fill="none" />
        {arc && (
          <Path
            d={arc}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
          />
        )}
        <Text
          x={center}
          y={center + 3}
          style={{ fontSize: 12, fontWeight: 700, fill: color, textAnchor: "middle" }}
        >
          {`${percent}%`}
        </Text>
      </Svg>
      <Text style={[styles.statLabel, { marginTop: 3, color: MUTED }]}>Overall adherence</Text>
    </View>
  );
}

// levelColor() returns `var(--color-status-*)` CSS custom properties
// for the "classic" bands, which resolve fine in the HTML preview but
// have no meaning to react-pdf's SVG renderer — map those back to this
// file's own hex constants before handing a color to a PDF primitive.
const CSS_VAR_TO_PDF_COLOR: Record<string, string> = {
  "var(--color-status-success)": SUCCESS,
  "var(--color-status-warning)": WARNING,
  "var(--color-status-danger)": DANGER,
};
function levelColorPdf(metric: WellbeingMetric, level: number, scheme?: MoodChartScheme): string {
  const color = levelColor(metric, level, scheme);
  return CSS_VAR_TO_PDF_COLOR[color] ?? color;
}

// A compact chart built from react-pdf's SVG primitives — react-pdf
// can't render the app's Recharts components, so trend data is drawn
// directly as a scaled polyline. Dot fill mirrors the reference
// report's convention: hollow when the day includes a standalone log
// entry, filled solid otherwise; color always reflects the pain/mood
// level itself (levelColor), independent of fill state.
function TrendChartPdf({
  points,
  metric,
  moodChartScheme,
}: {
  points: DailyAverage[];
  metric: "pain" | "mood";
  moodChartScheme?: MoodChartScheme;
}) {
  if (points.length === 0) {
    return <Text style={styles.emptyText}>No {metric} level data recorded for this period.</Text>;
  }
  const width = 480;
  const height = 110;
  const padX = 28;
  const padY = 14;
  const innerWidth = width - padX * 2;
  const innerHeight = height - padY * 2;
  const minDate = points[0].date;
  const maxDate = points[points.length - 1].date;
  const dateSpan = Math.max(1, new Date(maxDate).getTime() - new Date(minDate).getTime());
  const ticks = [1, 3, 5, 7, 10];

  const coords = points.map((p) => {
    const t = (new Date(p.date).getTime() - new Date(minDate).getTime()) / dateSpan;
    const x = padX + t * innerWidth;
    const y = padY + (1 - (p.level - 1) / 9) * innerHeight;
    return { x, y, p };
  });
  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const lineColor = metric === "mood" ? CYAN : BLUE;

  return (
    <View style={styles.chartWrap}>
      <Svg width={width} height={height}>
        {ticks.map((tick) => {
          const y = padY + (1 - (tick - 1) / 9) * innerHeight;
          return (
            <G key={tick}>
              <Polyline points={`${padX},${y} ${width - padX},${y}`} stroke={BORDER} strokeWidth={0.5} />
              <Text x={2} y={y + 3} style={{ fontSize: 7, fill: MUTED }}>
                {tick}
              </Text>
            </G>
          );
        })}
        <Polyline points={polylinePoints} stroke={lineColor} strokeWidth={1.5} fill="none" />
        {coords.map((c) => {
          const color = levelColorPdf(metric, c.p.level, moodChartScheme);
          return c.p.hasStandalone ? (
            <Circle key={c.p.date} cx={c.x} cy={c.y} r={3} fill="#ffffff" stroke={color} strokeWidth={1.5} />
          ) : (
            <Circle key={c.p.date} cx={c.x} cy={c.y} r={3} fill={color} />
          );
        })}
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
        <Text style={styles.tdMuted}>{formatShortDate(minDate)}</Text>
        <Text style={styles.tdMuted}>{formatShortDate(maxDate)}</Text>
      </View>
    </View>
  );
}

export interface TrendNoteEntry {
  date: string;
  time: string;
  source: "dose" | "standalone";
  medicationName: string;
  note: string;
  editedAt: string | null;
}

function PatientNotes({ notes }: { notes: TrendNoteEntry[] }) {
  if (notes.length === 0) return null;
  const byDate = new Map<string, TrendNoteEntry[]>();
  for (const n of notes) {
    const list = byDate.get(n.date) ?? [];
    list.push(n);
    byDate.set(n.date, list);
  }
  const dates = Array.from(byDate.keys()).sort();
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ fontSize: 8.5, fontWeight: 700, color: TEXT, marginBottom: 3 }}>Patient notes:</Text>
      {dates.map((date) => (
        <View key={date} style={{ marginBottom: 4 }} wrap={false}>
          <Text style={{ fontSize: 8, fontWeight: 700, color: NAVY, marginBottom: 1 }}>
            {formatLongDate(date)}
          </Text>
          {byDate.get(date)!.map((n, i) => (
            <Text key={i} style={{ fontSize: 8, color: TEXT, marginBottom: 1 }}>
              {to12h(n.time)}{" "}
              <Text style={{ color: MUTED }}>
                ({n.source} — {n.medicationName}):
              </Text>{" "}
              {n.note}
              {n.editedAt && (
                <Text style={{ fontSize: 7, fontStyle: "italic", color: MUTED }}>
                  {" "}
                  [edited {formatLongDate(n.editedAt.slice(0, 10))}]
                </Text>
              )}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export interface DoctorVisitReportData {
  patientName: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  allergies: ProfileAllergyWithName[];
  overallAdherencePercent: number;
  dosesScheduled: number;
  dosesTaken: number;
  dosesMissed: number;
  dosesSkipped: number;
  adherenceBreakout: { medication: Medication; percent: number; missed: number; scheduled: number }[];
  currentMedications: { medication: Medication; resumedOn: string | null }[];
  sideEffects: SideEffectRow[];
  discontinuedMedications: {
    medication: Medication;
    event: MedicationStatusEvent | null;
  }[];
  doseChanges: (DoseChangeEntry & { medication: Medication })[];
  missedDoseDetail: CalendarLogRow[];
  missedDoseDetailTotal: number;
  painTrends: { medication: Medication; points: DailyAverage[]; notes: TrendNoteEntry[] }[];
  moodTrends: { medication: Medication; points: DailyAverage[]; notes: TrendNoteEntry[] }[];
  moodChartScheme?: MoodChartScheme;
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

export function DoctorVisitReportPdf({ data }: { data: DoctorVisitReportData }) {
  return (
    <Document title="RxTracker Doctor Visit Report">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's <Image>, not an HTML <img> */}
          <Image src="/icons/icon-512.png" style={styles.logo} />
          <View>
            <Text style={styles.title}>Doctor Visit Report</Text>
            <Text style={styles.subtitle}>Prepared by RxTracker • Patient: {data.patientName}</Text>
            <Text style={styles.subtitle}>
              Reporting period: {formatShortDate(data.startDate)} – {formatShortDate(data.endDate)} • Generated:{" "}
              {data.generatedAt}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Known Allergies &amp; Intolerances</Text>
            <PdfTable
              columns={[
                { header: "Substance", flex: 2, render: (a: ProfileAllergyWithName) => a.name },
                {
                  header: "Type",
                  flex: 1,
                  render: (a: ProfileAllergyWithName) => (a.allergy_type === "allergy" ? "Allergy" : "Intolerance"),
                },
              ]}
              rows={data.allergies}
              emptyLabel="No allergies recorded."
            />
          </View>

          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Adherence Summary</Text>
            <View style={styles.statRow}>
              <AdherenceRingPdf percent={data.overallAdherencePercent} />
              <StatTile label="Doses scheduled" value={String(data.dosesScheduled)} />
              <StatTile label="Doses taken" value={String(data.dosesTaken)} color={SUCCESS} />
              <StatTile label="Doses missed" value={String(data.dosesMissed)} color={DANGER} />
              <StatTile label="Doses skipped" value={String(data.dosesSkipped)} color={WARNING} />
            </View>
            {data.adherenceBreakout.length > 0 && (
              <>
                <Text style={[styles.sectionDesc, { marginTop: 8 }]}>
                  Adherence by medication is broken out below where rates differ from the overall average.
                </Text>
                <PdfTable
                  columns={[
                    {
                      header: "Medication",
                      flex: 2,
                      render: (r: DoctorVisitReportData["adherenceBreakout"][number]) => (
                        <MedicationLabel medication={r.medication} suffix={`– ${r.medication.dose}`} />
                      ),
                    },
                    {
                      header: "Adherence",
                      flex: 1,
                      render: (r) => (
                        <Text style={{ fontSize: 8.5, fontWeight: 700, color: r.percent >= 80 ? SUCCESS : r.percent >= 50 ? WARNING : DANGER }}>
                          {r.percent}%
                        </Text>
                      ),
                    },
                    {
                      header: "Missed",
                      flex: 1,
                      render: (r) => `${r.missed} of ${r.scheduled}`,
                    },
                  ]}
                  rows={data.adherenceBreakout}
                  emptyLabel=""
                />
              </>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Medications</Text>
            <PdfTable
              columns={[
                {
                  header: "Medication",
                  flex: 2,
                  render: (r: DoctorVisitReportData["currentMedications"][number]) => (
                    <MedicationLabel
                      medication={r.medication}
                      annotation={r.resumedOn ? `(Resumed use on ${r.resumedOn})` : null}
                    />
                  ),
                },
                { header: "Dose", flex: 1, render: (r) => r.medication.dose },
                { header: "Start Date", flex: 1, render: (r) => (r.medication.start_date ? formatShortDate(r.medication.start_date) : "—") },
                { header: "Schedule", flex: 1.6, render: (r) => formatSchedule(r.medication) },
                { header: "Instructions", flex: 2, render: (r) => r.medication.instructions },
              ]}
              rows={data.currentMedications}
              emptyLabel="No medications selected for this report."
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reported Side Effects</Text>
            <Text style={styles.sectionDesc}>Patient-logged side effects for the reporting period, most recent first.</Text>
            <PdfTable
              columns={[
                { header: "Date", flex: 1, render: (se: SideEffectRow) => formatShortDate(se.occurred_date) },
                { header: "Medication", flex: 1.4, render: (se: SideEffectRow) => se.medications.name },
                { header: "Severity", flex: 1, render: (se: SideEffectRow) => se.severity },
                { header: "Side Effect", flex: 1.6, render: (se: SideEffectRow) => se.description },
                { header: "Notes", flex: 1.6, render: (se: SideEffectRow) => se.note },
              ]}
              rows={data.sideEffects}
              emptyLabel="No side effects logged for this period."
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Discontinued Medications</Text>
            <Text style={styles.sectionDesc}>
              Medications the patient has stopped using, with the reason and notes recorded when use was discontinued.
            </Text>
            <PdfTable
              columns={[
                {
                  header: "Medication",
                  flex: 2,
                  render: (r: DoctorVisitReportData["discontinuedMedications"][number]) => (
                    <MedicationLabel medication={r.medication} />
                  ),
                },
                { header: "Dose", flex: 0.8, render: (r) => r.medication.dose },
                { header: "Reason", flex: 1, render: (r) => r.event?.reason ?? "—" },
                { header: "Notes", flex: 1.4, render: (r) => r.event?.comment ?? "—" },
                {
                  header: "Date Discontinued",
                  flex: 1,
                  render: (r) => (r.event ? formatShortDate(r.event.event_at.slice(0, 10)) : "—"),
                },
              ]}
              rows={data.discontinuedMedications}
              emptyLabel="No discontinued medications for this profile."
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dose Changes</Text>
            <PdfTable
              columns={[
                {
                  header: "Date",
                  flex: 1,
                  render: (r: DoctorVisitReportData["doseChanges"][number]) => formatShortDate(r.at.slice(0, 10)),
                },
                { header: "Medication", flex: 1.4, render: (r) => r.medication.name },
                {
                  header: "Change",
                  flex: 1,
                  render: (r) => {
                    const from = r.data.old_dose_amount != null ? `${r.data.old_dose_amount}${r.data.old_dose_unit}` : null;
                    const to = r.data.new_dose_amount != null ? `${r.data.new_dose_amount}${r.data.new_dose_unit}` : null;
                    if (from && to) return `${from} -> ${to}`;
                    if (to) return `Set to ${to}`;
                    if (from) return `Removed from ${from}`;
                    return "—";
                  },
                },
                { header: "Comment", flex: 1.6, render: (r) => r.data.comment },
              ]}
              rows={data.doseChanges}
              emptyLabel="No dose changes recorded during this period."
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Missed Dose Detail</Text>
            <Text style={styles.sectionDesc}>
              Showing missed and skipped doses for the reporting period, most recent first.
            </Text>
            <PdfTable
              columns={[
                { header: "Date", flex: 1, render: (l: CalendarLogRow) => formatShortDate(l.scheduled_for_date) },
                { header: "Medication", flex: 1.6, render: (l: CalendarLogRow) => `${l.medications.name} – ${l.medications.dose}` },
                { header: "Scheduled Time", flex: 1, render: (l: CalendarLogRow) => to12h(l.scheduled_time.slice(0, 5)) },
                {
                  header: "Status",
                  flex: 1,
                  render: (l: CalendarLogRow) => (
                    <Text style={{ fontSize: 8.5, fontWeight: 700, color: l.status === "missed" ? DANGER : WARNING, textTransform: "capitalize" }}>
                      {l.status}
                    </Text>
                  ),
                },
              ]}
              rows={data.missedDoseDetail}
              emptyLabel="No missed or skipped doses for this period."
            />
            {data.missedDoseDetailTotal > data.missedDoseDetail.length && (
              <Text style={[styles.emptyText, { marginTop: 4 }]}>
                {`+ ${data.missedDoseDetailTotal - data.missedDoseDetail.length} additional missed/skipped doses in this period (full list available in app).`}
              </Text>
            )}
          </View>

          {data.painTrends.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pain Level Tracking</Text>
              <Text style={styles.sectionDesc}>
                Recorded after doses and as standalone logs for medications with pain tracking enabled. Chart shows
                daily pain level (1–10) over the reporting period. Hollow circles indicate standalone log entries.
              </Text>
              {data.painTrends.map(({ medication, points, notes }) => {
                const avg = points.length
                  ? (points.reduce((sum, p) => sum + p.level, 0) / points.length).toFixed(1)
                  : "—";
                return (
                  <View key={medication.id} style={{ marginBottom: 14 }}>
                    <View wrap={false}>
                      <MedicationLabel medication={medication} />
                      <Text style={[styles.tdMuted, { marginTop: 4 }]}>
                        {`Reporting period: ${formatShortDate(data.startDate)} – ${formatShortDate(data.endDate)}  |  Avg pain: ${avg}/10  |  Days logged: ${points.length}`}
                      </Text>
                      <TrendChartPdf points={points} metric="pain" />
                    </View>
                    <PatientNotes notes={notes} />
                  </View>
                );
              })}
            </View>
          )}

          {data.moodTrends.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Mood &amp; Wellbeing Tracking</Text>
              <Text style={styles.sectionDesc}>
                Recorded after doses and as standalone logs for medications with mood tracking enabled. Chart shows
                daily mood level (1–10) over the reporting period. Hollow circles indicate standalone log entries.
              </Text>
              {data.moodTrends.map(({ medication, points, notes }) => {
                const avg = points.length
                  ? (points.reduce((sum, p) => sum + p.level, 0) / points.length).toFixed(1)
                  : "—";
                return (
                  <View key={medication.id} style={{ marginBottom: 14 }}>
                    <View wrap={false}>
                      <MedicationLabel medication={medication} />
                      <Text style={[styles.tdMuted, { marginTop: 4 }]}>
                        {`Reporting period: ${formatShortDate(data.startDate)} – ${formatShortDate(data.endDate)}  |  Avg mood: ${avg}/10  |  Days logged: ${points.length}`}
                      </Text>
                      <TrendChartPdf points={points} metric="mood" moodChartScheme={data.moodChartScheme} />
                    </View>
                    <PatientNotes notes={notes} />
                  </View>
                );
              })}
            </View>
          )}

        </View>

        {/* A direct child of <Page> (not nested inside the paginated
            `body` View above) so its "fixed" position is anchored to
            each physical page, not to body's own per-page fragment —
            nesting it inside body previously let it render wherever
            body's box happened to end, overlapping the last section
            on some pages. */}
        <View style={styles.footer} fixed>
          <Text style={{ fontSize: 7.5, color: MUTED, lineHeight: 1.4 }}>
            RxTracker is a self-tracking aid and does not provide medical advice or clinical decision support. This
            report reflects patient-logged data only and has not been independently verified. Always consult your
            healthcare provider.
          </Text>
          <Text
            style={{ fontSize: 7.5, color: MUTED, marginTop: 3 }}
            render={({ pageNumber, totalPages }) => `Generated ${data.generatedAt} · Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
