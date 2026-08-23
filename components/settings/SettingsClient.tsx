"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getMissedGraceMinutes,
  getMoodChartScheme,
  getSnoozeMinutes,
  setMissedGraceMinutes,
  setMoodChartScheme,
  setSnoozeMinutes,
  type MoodChartScheme,
} from "@/lib/app-settings";
import {
  isAlarmSoundEnabled,
  isVibrationEnabled,
  previewAlarm,
  setAlarmSoundEnabled,
  setVibrationEnabled,
} from "@/lib/notifications";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";

export function SettingsClient() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-brand-navy">Settings</h1>
      <GeneralSettingsPanel />
      <AlarmSettingsPanel />
    </div>
  );
}

function GeneralSettingsPanel() {
  const queryClient = useQueryClient();

  const graceQuery = useQuery({
    queryKey: ["app-settings", "missed_grace_minutes"],
    queryFn: getMissedGraceMinutes,
  });
  const snoozeQuery = useQuery({
    queryKey: ["app-settings", "snooze_minutes"],
    queryFn: getSnoozeMinutes,
  });

  const [graceMinutes, setGraceMinutes] = useState<number | null>(null);
  const [snoozeMinutes, setSnoozeMinutesState] = useState<number | null>(null);

  // Seed local editable state from the loaded values the first time each
  // arrives, without clobbering an in-progress edit on every background
  // refetch — adjusted during render (not an effect+setState), matching
  // the "sync local state from a loaded value once" pattern used
  // elsewhere in this app (e.g. GroupModal, HistoryClient).
  const [seededGrace, setSeededGrace] = useState(false);
  if (!seededGrace && graceQuery.data !== undefined) {
    setSeededGrace(true);
    setGraceMinutes(graceQuery.data);
  }
  const [seededSnooze, setSeededSnooze] = useState(false);
  if (!seededSnooze && snoozeQuery.data !== undefined) {
    setSeededSnooze(true);
    setSnoozeMinutesState(snoozeQuery.data);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (graceMinutes !== null) await setMissedGraceMinutes(graceMinutes);
      if (snoozeMinutes !== null) await setSnoozeMinutes(snoozeMinutes);
    },
    onSuccess: () => {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["app-settings", "missed_grace_minutes"] });
      queryClient.invalidateQueries({ queryKey: ["app-settings", "snooze_minutes"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save settings"),
  });

  const loading = graceMinutes === null || snoozeMinutes === null;

  return (
    <section className="flex flex-col gap-4 rounded-card border border-brand-border bg-brand-card p-4">
      <h2 className="text-base font-bold text-brand-navy">General Settings</h2>

      {loading ? (
        <p className="text-sm text-brand-text-muted">Loading…</p>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <Field label="Missed-dose grace period">
            <select
              className={inputClass}
              value={graceMinutes}
              onChange={(e) => setGraceMinutes(Number(e.target.value))}
            >
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </Field>
          <Field label="Default snooze duration">
            <select
              className={inputClass}
              value={snoozeMinutes}
              onChange={(e) => setSnoozeMinutesState(Number(e.target.value))}
            >
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
            </select>
          </Field>
          <Button type="submit" disabled={saveMutation.isPending} className="self-start">
            {saveMutation.isPending ? "Saving…" : "Save settings"}
          </Button>
        </form>
      )}
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 text-sm text-brand-text">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-brand-text-muted">{description}</span>
      </span>
    </label>
  );
}

function AlarmSettingsPanel() {
  const queryClient = useQueryClient();

  // Sound/vibration are device-local (localStorage), not server settings
  // — matches the reference app, whose equivalent toggles are also
  // client-only. Lazy initializer reads them synchronously on the
  // client's first render, same pattern as ActiveProfileProvider.
  const [soundEnabled, setSoundEnabledState] = useState(() => isAlarmSoundEnabled());
  const [vibrationEnabled, setVibrationEnabledState] = useState(() => isVibrationEnabled());

  const moodSchemeQuery = useQuery({
    queryKey: ["app-settings", "mood_chart_scheme"],
    queryFn: getMoodChartScheme,
  });

  const moodSchemeMutation = useMutation({
    mutationFn: (scheme: MoodChartScheme) => setMoodChartScheme(scheme),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings", "mood_chart_scheme"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't save mood chart color");
      queryClient.invalidateQueries({ queryKey: ["app-settings", "mood_chart_scheme"] });
    },
  });

  return (
    <section className="flex flex-col gap-4 rounded-card border border-brand-border bg-brand-card p-4">
      <h2 className="text-base font-bold text-brand-navy">Alarm &amp; Notification Settings</h2>
      <p className="text-sm text-brand-text-muted">
        Alerts you while RxTracker is open in this tab when a dose becomes due.
      </p>

      <div className="flex flex-col gap-3">
        <ToggleRow
          label="Alarm sound"
          description="Audible alarm when a dose is due. On by default."
          checked={soundEnabled}
          onChange={(checked) => {
            setSoundEnabledState(checked);
            setAlarmSoundEnabled(checked);
          }}
        />
        <ToggleRow
          label="Vibration"
          description="Device vibration for in-app alarms. On by default."
          checked={vibrationEnabled}
          onChange={(checked) => {
            setVibrationEnabledState(checked);
            setVibrationEnabled(checked);
          }}
        />
        <ToggleRow
          label="Teal mood chart"
          description="Use a teal gradient for the mood trend chart (matches the export report) instead of the red-to-green scale."
          checked={moodSchemeQuery.data === "teal"}
          onChange={(checked) => moodSchemeMutation.mutate(checked ? "teal" : "classic")}
        />
      </div>

      <Button type="button" variant="secondary" onClick={previewAlarm} className="self-start">
        Test alarm
      </Button>
    </section>
  );
}
