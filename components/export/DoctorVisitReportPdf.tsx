import { Circle, Document, Image, Page, Polyline, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { ALLERGY_SEVERITY_LABELS } from "@/lib/allergies";
import type { CalendarLogRow } from "@/lib/dose-logs";
import type { DoseHistoryEntry } from "@/lib/medications";
import type { DailyAverage } from "@/lib/pain-mood";
import type { SideEffectRow } from "@/lib/side-effects";
import type { ProfileAllergyWithName } from "@/lib/types/profile";
import { daysUntilRunout, to12h } from "@/lib/utils";
import type { Medication, MedicationDoseChange } from "@/lib/types/medications";

type DoseChangeEntry = Extract<DoseHistoryEntry, { type: "dose_change" }>;

const COLORS = {
  navy: "#1e3a5f",
  text: "#1f2937",
  muted: "#6b7280",
  border: "#e2e8f0",
  line: "#2563eb",
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, color: COLORS.text, fontFamily: "Helvetica" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, borderBottom: `1pt solid ${COLORS.border}`, paddingBottom: 10, marginBottom: 14 },
  logo: { width: 34, height: 34, borderRadius: 6 },
  title: { fontSize: 16, fontWeight: 700, color: COLORS.navy },
  subtitle: { fontSize: 9, color: COLORS.muted, marginTop: 2 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: COLORS.navy, marginBottom: 6 },
  emptyText: { fontSize: 9, color: COLORS.muted },
  table: { borderTop: `1pt solid ${COLORS.border}` },
  tableRow: { flexDirection: "row", borderBottom: `1pt solid ${COLORS.border}`, paddingVertical: 4 },
  tableHeaderRow: { flexDirection: "row", paddingVertical: 4 },
  th: { fontSize: 8, fontWeight: 700, color: COLORS.muted },
  td: { fontSize: 8.5, color: COLORS.text },
  tdMuted: { fontSize: 8.5, color: COLORS.muted },
  listItem: { fontSize: 9, marginBottom: 3 },
  chartWrap: { marginTop: 2 },
});

function cellStyle(flex: number) {
  return { flex, paddingRight: 4 };
}

interface Column<T> {
  header: string;
  flex: number;
  render: (row: T) => string;
}

function PdfTable<T>({ columns, rows, emptyLabel }: { columns: Column<T>[]; rows: T[]; emptyLabel: string }) {
  if (rows.length === 0) {
    return <Text style={styles.emptyText}>{emptyLabel}</Text>;
  }
  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow}>
        {columns.map((col) => (
          <Text key={col.header} style={[styles.th, cellStyle(col.flex)]}>
            {col.header}
          </Text>
        ))}
      </View>
      {rows.map((row, i) => (
        <View key={i} style={styles.tableRow} wrap={false}>
          {columns.map((col) => (
            <Text key={col.header} style={[styles.td, cellStyle(col.flex)]}>
              {col.render(row) || "—"}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
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
  const from = change.old_dose_amount != null ? `${change.old_dose_amount}${change.old_dose_unit}` : null;
  const to = change.new_dose_amount != null ? `${change.new_dose_amount}${change.new_dose_unit}` : null;
  if (from && to) return `${from} -> ${to}`;
  if (to) return `Set to ${to}`;
  if (from) return `Removed from ${from}`;
  return "—";
}

// A compact inline sparkline built from react-pdf's SVG primitives —
// @react-pdf/renderer can't render the app's Recharts <ReportTrendChart>
// (canvas/SVG-in-DOM), so trend data is plotted directly as a scaled
// polyline instead, keeping the PDF a single render pass with real
// (searchable/selectable) text, not a rasterized screenshot.
function TrendSparkline({ points }: { points: DailyAverage[] }) {
  if (points.length === 0) {
    return <Text style={styles.emptyText}>No level data recorded for this period.</Text>;
  }
  const width = 480;
  const height = 90;
  const padX = 24;
  const padY = 12;
  const innerWidth = width - padX * 2;
  const innerHeight = height - padY * 2;
  const minDate = points[0].date;
  const maxDate = points[points.length - 1].date;
  const dateSpan = Math.max(1, new Date(maxDate).getTime() - new Date(minDate).getTime());

  const coords = points.map((p) => {
    const t = (new Date(p.date).getTime() - new Date(minDate).getTime()) / dateSpan;
    const x = padX + t * innerWidth;
    const y = padY + (1 - (p.level - 1) / 9) * innerHeight;
    return { x, y, p };
  });
  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <View style={styles.chartWrap}>
      <Svg width={width} height={height}>
        {[1, 5, 10].map((tick) => {
          const y = padY + (1 - (tick - 1) / 9) * innerHeight;
          return (
            <Text key={tick} x={2} y={y + 3} style={{ fontSize: 7, fill: COLORS.muted }}>
              {tick}
            </Text>
          );
        })}
        <Polyline points={polylinePoints} stroke={COLORS.line} strokeWidth={1.5} fill="none" />
        {coords.map((c) => (
          <Circle key={c.p.date} cx={c.x} cy={c.y} r={2} fill={COLORS.line} />
        ))}
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
        <Text style={styles.tdMuted}>{minDate}</Text>
        <Text style={styles.tdMuted}>{maxDate}</Text>
      </View>
    </View>
  );
}

export interface DoctorVisitReportData {
  patientEmail: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  medications: Medication[];
  doseChangeGroups: { medication: Medication; changes: DoseChangeEntry[] }[];
  doseLogs: CalendarLogRow[];
  historyCapped: boolean;
  historyCap: number;
  sideEffects: SideEffectRow[];
  allergies: ProfileAllergyWithName[];
  overallAdherence: number;
  perMedicationAdherence: { medication: Medication; percent: number }[];
  painTrends: { medication: Medication; points: DailyAverage[] }[];
  moodTrends: { medication: Medication; points: DailyAverage[] }[];
}

export function DoctorVisitReportPdf({ data }: { data: DoctorVisitReportData }) {
  return (
    <Document title="RxTracker Doctor Visit Report">
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's <Image>, not an HTML <img> */}
          <Image src="/icons/icon-512.png" style={styles.logo} />
          <View>
            <Text style={styles.title}>RxTracker — Doctor Visit Report</Text>
            <Text style={styles.subtitle}>
              {data.patientEmail} · {data.startDate} to {data.endDate}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medications</Text>
          <PdfTable
            columns={[
              { header: "Name", flex: 2, render: (m: Medication) => m.name },
              { header: "Dose", flex: 1.2, render: (m: Medication) => m.dose },
              { header: "Schedule", flex: 1.6, render: formatSchedule },
              { header: "Instructions", flex: 2, render: (m: Medication) => m.instructions },
              { header: "Supply", flex: 1, render: formatSupply },
              { header: "Runout", flex: 1, render: formatRunout },
              { header: "Start date", flex: 1, render: (m: Medication) => m.start_date ?? "—" },
            ]}
            rows={data.medications}
            emptyLabel="No medications selected for this report."
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dose change history</Text>
          {data.doseChangeGroups.length === 0 ? (
            <Text style={styles.emptyText}>No dose changes recorded.</Text>
          ) : (
            data.doseChangeGroups.map(({ medication, changes }) => (
              <View key={medication.id} style={{ marginBottom: 6 }} wrap={false}>
                <Text style={{ fontSize: 9.5, fontWeight: 700, marginBottom: 2 }}>{medication.name}</Text>
                {changes.map((change) => (
                  <Text key={change.data.id} style={styles.listItem}>
                    {new Date(change.at).toLocaleDateString()} — {formatDoseChange(change.data)}
                    {change.data.comment && ` (${change.data.comment})`}
                  </Text>
                ))}
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dose history</Text>
          <PdfTable
            columns={[
              { header: "Date", flex: 1, render: (l: CalendarLogRow) => l.scheduled_for_date },
              { header: "Medication", flex: 1.5, render: (l: CalendarLogRow) => l.medications.name },
              { header: "Time", flex: 0.8, render: (l: CalendarLogRow) => to12h(l.scheduled_time.slice(0, 5)) },
              { header: "Status", flex: 0.8, render: (l: CalendarLogRow) => l.status },
              { header: "Pain", flex: 0.6, render: (l: CalendarLogRow) => (l.pain_level != null ? String(l.pain_level) : "—") },
              { header: "Mood", flex: 0.6, render: (l: CalendarLogRow) => (l.mood_level != null ? String(l.mood_level) : "—") },
              { header: "Notes", flex: 2, render: (l: CalendarLogRow) => l.note },
            ]}
            rows={data.doseLogs}
            emptyLabel="No doses logged for this period."
          />
          {data.historyCapped && (
            <Text style={[styles.emptyText, { marginTop: 4 }]}>
              Showing the most recent {data.historyCap} entries for this period.
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Side effects</Text>
          {data.sideEffects.length === 0 ? (
            <Text style={styles.emptyText}>None reported for this period.</Text>
          ) : (
            data.sideEffects.map((se) => (
              <Text key={se.id} style={styles.listItem}>
                {se.occurred_date} — {se.medications.name}: {se.description} ({se.severity})
              </Text>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Allergies</Text>
          {data.allergies.length === 0 ? (
            <Text style={styles.emptyText}>No allergies recorded.</Text>
          ) : (
            data.allergies.map((a) => (
              <Text key={a.id} style={styles.listItem}>
                {a.name}
                {!a.is_active ? " (inactive)" : ""} — {a.allergy_type === "allergy" ? "Allergy" : "Intolerance"}
                {a.life_threatening
                  ? " · Life-threatening"
                  : a.severity
                    ? ` · ${ALLERGY_SEVERITY_LABELS[a.severity]}`
                    : ""}
              </Text>
            ))
          )}
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Adherence</Text>
          <Text style={{ fontSize: 9.5, marginBottom: 4 }}>Overall: {data.overallAdherence}%</Text>
          {data.perMedicationAdherence.map(({ medication, percent }) => (
            <View key={medication.id} style={{ flexDirection: "row", justifyContent: "space-between", maxWidth: 280 }}>
              <Text style={styles.tdMuted}>{medication.name}</Text>
              <Text style={styles.tdMuted}>{percent}%</Text>
            </View>
          ))}
        </View>

        {data.painTrends.map(({ medication, points }) => (
          <View key={medication.id} style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Pain trend — {medication.name}</Text>
            <TrendSparkline points={points} />
          </View>
        ))}

        {data.moodTrends.map(({ medication, points }) => (
          <View key={medication.id} style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Mood trend — {medication.name}</Text>
            <TrendSparkline points={points} />
          </View>
        ))}

        <Text
          style={{ position: "absolute", bottom: 20, left: 32, right: 32, fontSize: 7, color: COLORS.muted, textAlign: "center" }}
          fixed
          render={({ pageNumber, totalPages }) => `Generated ${data.generatedAt} · Page ${pageNumber} of ${totalPages}`}
        />
      </Page>
    </Document>
  );
}
