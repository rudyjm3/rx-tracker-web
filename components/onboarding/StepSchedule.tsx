"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { saveDraft, type ParsedDraft } from "@/lib/drafts";
import type { MedicationFormValues } from "@/components/medications/wizard/schema";
import { useOnboarding } from "./OnboardingContext";

const PRESETS = [
  { label: "Morning 8am", time: "08:00" },
  { label: "Noon", time: "12:00" },
  { label: "Evening 6pm", time: "18:00" },
  { label: "Bedtime 10pm", time: "22:00" },
];

interface TimeSlot {
  reminderTime: string;
  quantityPerDose?: string;
}

function ScheduleCard({ draft }: { draft: ParsedDraft<MedicationFormValues> }) {
  const { profileId, refreshDrafts } = useOnboarding();
  const [times, setTimes] = useState<TimeSlot[]>(draft.formData.scheduleTimes);
  const [customTime, setCustomTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function addTime(time: string) {
    if (!time || times.some((t) => t.reminderTime === time)) return;
    setTimes((prev) => [...prev, { reminderTime: time, quantityPerDose: "" }].sort((a, b) =>
      a.reminderTime.localeCompare(b.reminderTime),
    ));
    setSaved(false);
  }

  function removeTime(time: string) {
    setTimes((prev) => prev.filter((t) => t.reminderTime !== time));
    setSaved(false);
  }

  function updateQuantity(time: string, value: string) {
    setTimes((prev) =>
      prev.map((t) => (t.reminderTime === time ? { ...t, quantityPerDose: value } : t)),
    );
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveDraft({
        id: draft.id,
        formData: { ...draft.formData, scheduleMode: "fixed_times", scheduleTimes: times },
        currentStep: 3,
        furthestStep: Math.max(draft.furthestStep, 3),
        profileId,
      });
      refreshDrafts();
      setSaved(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save schedule");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-control border border-brand-border p-4">
      <h3 className="mb-3 font-medium text-brand-text">
        {draft.formData.name || "Untitled medication"}
      </h3>

      <div className="mb-3 flex flex-col gap-2">
        {times.map((t) => (
          <div key={t.reminderTime} className="flex items-center gap-2">
            <span className={inputClass}>{t.reminderTime}</span>
            <input
              type="number"
              step="any"
              placeholder="Qty override (optional)"
              className={inputClass}
              value={t.quantityPerDose ?? ""}
              onChange={(e) => updateQuantity(t.reminderTime, e.target.value)}
            />
            <button
              type="button"
              onClick={() => removeTime(t.reminderTime)}
              aria-label="Remove time"
              className="text-brand-text-muted hover:text-status-danger"
            >
              <X size={16} />
            </button>
          </div>
        ))}
        {times.length === 0 && (
          <p className="text-sm text-brand-text-muted">No times added yet.</p>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.time}
            type="button"
            size="compact"
            variant="secondary"
            onClick={() => addTime(preset.time)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-2">
        <input
          type="time"
          className={inputClass}
          value={customTime}
          onChange={(e) => setCustomTime(e.target.value)}
        />
        <Button
          type="button"
          size="compact"
          variant="secondary"
          onClick={() => {
            addTime(customTime);
            setCustomTime("");
          }}
        >
          Add
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" size="compact" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-status-success">
            <Check size={14} /> Saved
          </span>
        )}
      </div>
    </div>
  );
}

export function StepSchedule() {
  const { drafts } = useOnboarding();
  const scheduledDrafts = drafts.filter((d) => !d.formData.asNeeded);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-brand-text-muted">
        Set reminder times for each medication. Add at least one time and save before continuing.
      </p>
      {scheduledDrafts.length === 0 ? (
        <p className="text-sm text-brand-text-muted">
          All of your medications are as-needed — nothing to schedule.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {scheduledDrafts.map((draft) => (
            <ScheduleCard key={draft.id} draft={draft} />
          ))}
        </div>
      )}
    </div>
  );
}
