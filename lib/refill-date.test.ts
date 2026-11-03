import assert from "node:assert/strict";
import { test } from "node:test";

process.env.TZ = "America/Los_Angeles";
import { suggestNextRefillDate } from "./utils.ts";

// Only the fields daysUntilRunout reads.
function med(overrides: Record<string, unknown> = {}) {
  return {
    current_quantity: 0,
    as_needed: false,
    schedule_mode: "fixed_times",
    quantity_per_dose: 1,
    interval_hours: null,
    medication_schedule_times: [
      { reminder_time: "08:00:00", quantity_per_dose: null, group_id: null },
    ],
    ...overrides,
  } as never;
}

test("adds the days the supply lasts to the refill date", () => {
  assert.equal(suggestNextRefillDate(med(), 30, "2026-11-03"), "2026-12-03");
});

test("counts stock already on hand", () => {
  assert.equal(suggestNextRefillDate(med({ current_quantity: 5 }), 25, "2026-11-03"), "2026-12-03");
});

test("twice-daily dosing halves the supply length", () => {
  const twice = med({
    medication_schedule_times: [
      { reminder_time: "08:00:00", quantity_per_dose: null, group_id: null },
      { reminder_time: "20:00:00", quantity_per_dose: null, group_id: null },
    ],
  });
  assert.equal(suggestNextRefillDate(twice, 30, "2026-11-03"), "2026-11-18");
});

test("falls back to 30 days when no projection is possible", () => {
  const prn = med({ as_needed: true });
  assert.equal(suggestNextRefillDate(prn, 10, "2026-11-03"), "2026-12-03");
});
