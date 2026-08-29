"use client";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { to12h } from "@/lib/utils";
import { useOnboarding } from "./OnboardingContext";
import { buildTodayReconcileSlots } from "./reconcile";

export function StepReconcile() {
  const { drafts, reconcileMarks, setReconcileMarks } = useOnboarding();
  const slots = buildTodayReconcileSlots(drafts);

  const groups = new Map<string, typeof slots>();
  for (const slot of slots) {
    const existing = groups.get(slot.scheduledTime) ?? [];
    existing.push(slot);
    groups.set(slot.scheduledTime, existing);
  }

  function markFor(draftId: string, scheduledTime: string) {
    return reconcileMarks.find((m) => m.draftId === draftId && m.scheduledTime === scheduledTime);
  }

  function setMark(draftId: string, scheduledTime: string, quantityPerDose: number, status: "taken" | "skipped") {
    setReconcileMarks((prev) => [
      ...prev.filter((m) => !(m.draftId === draftId && m.scheduledTime === scheduledTime)),
      { draftId, scheduledTime, quantityPerDose, status },
    ]);
  }

  function markAll(time: string, status: "taken" | "skipped") {
    const group = groups.get(time) ?? [];
    setReconcileMarks((prev) => {
      const withoutGroup = prev.filter(
        (m) => !group.some((s) => s.draftId === m.draftId && s.scheduledTime === m.scheduledTime),
      );
      return [
        ...withoutGroup,
        ...group.map((s) => ({
          draftId: s.draftId,
          scheduledTime: s.scheduledTime,
          quantityPerDose: s.quantityPerDose,
          status,
        })),
      ];
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-brand-text-muted">
        These doses were already due today, based on the schedule you just set up. Mark which ones
        you&rsquo;ve already taken — anything left unmarked just starts being tracked from now on.
      </p>

      {Array.from(groups.entries()).map(([time, group]) => (
        <div key={time} className="rounded-control border border-brand-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium text-brand-text">{to12h(time)}</h3>
            <div className="flex gap-2">
              <Button type="button" size="compact" variant="secondary" onClick={() => markAll(time, "taken")}>
                Mark all taken
              </Button>
              <Button type="button" size="compact" variant="secondary" onClick={() => markAll(time, "skipped")}>
                Skip all
              </Button>
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            {group.map((slot) => {
              const mark = markFor(slot.draftId, slot.scheduledTime);
              return (
                <li
                  key={`${slot.draftId}-${slot.scheduledTime}`}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-brand-text">{slot.medicationName}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMark(slot.draftId, slot.scheduledTime, slot.quantityPerDose, "taken")}
                      className={cn(
                        "rounded-control border px-2 py-1 text-xs",
                        mark?.status === "taken"
                          ? "border-status-success bg-status-success/10 text-status-success"
                          : "border-brand-border text-brand-text-muted",
                      )}
                    >
                      Taken
                    </button>
                    <button
                      type="button"
                      onClick={() => setMark(slot.draftId, slot.scheduledTime, slot.quantityPerDose, "skipped")}
                      className={cn(
                        "rounded-control border px-2 py-1 text-xs",
                        mark?.status === "skipped"
                          ? "border-status-danger bg-status-danger/10 text-status-danger"
                          : "border-brand-border text-brand-text-muted",
                      )}
                    >
                      Skipped
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
