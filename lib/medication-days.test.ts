import assert from "node:assert/strict";
import { test } from "node:test";
import { activeDaysOnMedication } from "./medication-days.ts";

const ev = (event: string, day: string) => ({ event, event_at: `${day}T12:00:00Z` });

test("no start date", () => {
  assert.equal(activeDaysOnMedication(null, [], "2026-10-22"), null);
});

test("still active counts through asOf, inclusive", () => {
  assert.equal(activeDaysOnMedication("2026-10-22", [], "2026-10-22"), 1);
  assert.equal(activeDaysOnMedication("2026-10-01", [], "2026-10-10"), 10);
});

test("discontinued once stops counting at discontinue date", () => {
  const events = [ev("discontinued", "2026-10-05")];
  assert.equal(activeDaysOnMedication("2026-10-01", events, "2026-10-22"), 5);
});

test("discontinued, resumed 2 weeks later, discontinued again", () => {
  const events = [
    ev("discontinued", "2026-10-05"),
    ev("resumed", "2026-10-19"),
    ev("discontinued", "2026-10-25"),
  ];
  // Oct 1-5 (5) + Oct 19-25 (7)
  assert.equal(activeDaysOnMedication("2026-10-01", events, "2026-11-30"), 12);
});

test("resumed and still active runs to asOf", () => {
  const events = [ev("discontinued", "2026-10-05"), ev("resumed", "2026-10-19")];
  assert.equal(activeDaysOnMedication("2026-10-01", events, "2026-10-22"), 5 + 4);
});

test("same-day discontinue and resume counts the day once", () => {
  const events = [ev("discontinued", "2026-10-05"), ev("resumed", "2026-10-05")];
  assert.equal(activeDaysOnMedication("2026-10-01", events, "2026-10-10"), 10);
});

test("unsorted events and stray resume are tolerated", () => {
  const events = [
    ev("discontinued", "2026-10-05"),
    ev("resumed", "2026-10-02"),
  ];
  assert.equal(activeDaysOnMedication("2026-10-01", events, "2026-10-22"), 5);
});

test("events after asOf are ignored", () => {
  const events = [ev("discontinued", "2026-10-25")];
  assert.equal(activeDaysOnMedication("2026-10-01", events, "2026-10-10"), 10);
});
