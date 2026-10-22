// Days a medication was actually in use, summed over its active stretches.
// A medication is active from its start date until a "discontinued"
// event, and again from each "resumed" event until the next
// discontinue; the last stretch runs to `asOf` if it's still active.
// Days are inclusive and a day shared by two stretches (discontinued and
// resumed the same day) counts once.

export interface MedicationStatusEventLike {
  event: string;
  event_at: string;
}

const DAY_MS = 86_400_000;

function dayNumber(date: string): number {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

// Status events are timestamptz values, so convert to the viewer's local
// calendar date (matching the local start/as-of dates) before counting.
function eventDayNumber(eventAt: string): number {
  if (!eventAt.includes("T")) return dayNumber(eventAt);
  const d = new Date(eventAt);
  if (Number.isNaN(d.getTime())) return dayNumber(eventAt);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

export function activeDaysOnMedication(
  startDate: string | null,
  events: MedicationStatusEventLike[],
  asOf: string,
): number | null {
  if (!startDate) return null;
  const end = dayNumber(asOf);
  const sorted = events
    .filter((e) => e.event === "discontinued" || e.event === "resumed")
    .sort((a, b) => a.event_at.localeCompare(b.event_at));

  const stretches: Array<[number, number]> = [];
  let activeFrom: number | null = dayNumber(startDate);
  for (const e of sorted) {
    const day = eventDayNumber(e.event_at);
    if (day > end) break;
    if (e.event === "discontinued" && activeFrom !== null) {
      stretches.push([activeFrom, day]);
      activeFrom = null;
    } else if (e.event === "resumed" && activeFrom === null) {
      activeFrom = day;
    }
  }
  if (activeFrom !== null) stretches.push([activeFrom, end]);

  let total = 0;
  let coveredUntil = -Infinity;
  for (const [from, to] of stretches) {
    if (to < from) continue;
    total += to - Math.max(from, coveredUntil + 1) + 1;
    coveredUntil = Math.max(coveredUntil, to);
  }
  return total;
}
