"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HelpCircle, Smartphone, Trash2 } from "lucide-react";
import { useAuth } from "@/components/layout/AuthProvider";
import {
  getMissedGraceMinutes,
  getMoodChartScheme,
  getSnoozeMinutes,
  MISSED_GRACE_MAX_MINUTES,
  MISSED_GRACE_MIN_MINUTES,
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
import {
  getPushSubscriptions,
  removePushSubscription,
  type PushSubscriptionRow,
} from "@/lib/push-subscriptions";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";

export function SettingsClient() {
  const { user } = useAuth();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-brand-navy">Settings</h1>
      {/* Keyed by user id so a sign-out/sign-in within the same browser
          tab (the app_settings query cache is process-wide, not scoped
          per user) forces a fresh mount instead of leaving the previous
          account's values seeded into this panel's local edit state. */}
      <GeneralSettingsPanel key={user?.id} />
      <AlarmSettingsPanel />
      <PushSubscriptionsPanel key={`push-${user?.id}`} />
      <HelpPanel />
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

  const loading = !seededGrace || !seededSnooze;
  const graceInvalid =
    graceMinutes === null ||
    !Number.isInteger(graceMinutes) ||
    graceMinutes < MISSED_GRACE_MIN_MINUTES ||
    graceMinutes > MISSED_GRACE_MAX_MINUTES;

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
          <Field
            label="Mark dose missed after"
            error={
              graceInvalid
                ? `Enter a whole number between ${MISSED_GRACE_MIN_MINUTES} and ${MISSED_GRACE_MAX_MINUTES}.`
                : undefined
            }
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={MISSED_GRACE_MIN_MINUTES}
                max={MISSED_GRACE_MAX_MINUTES}
                step={1}
                className={`${inputClass} w-24`}
                value={graceMinutes ?? ""}
                onChange={(e) => {
                  const value = e.target.value === "" ? null : Number(e.target.value);
                  setGraceMinutes(value);
                }}
              />
              <span className="text-sm text-brand-text-muted">minutes</span>
            </div>
          </Field>
          <Field label="Default snooze duration">
            <select
              className={inputClass}
              value={snoozeMinutes ?? ""}
              onChange={(e) => setSnoozeMinutesState(Number(e.target.value))}
            >
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
            </select>
          </Field>
          <Button
            type="submit"
            disabled={saveMutation.isPending || graceInvalid}
            className="self-start"
          >
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

function PushSubscriptionsPanel() {
  const queryClient = useQueryClient();
  const queryKey = ["push-subscriptions"];

  const devicesQuery = useQuery({
    queryKey,
    queryFn: getPushSubscriptions,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removePushSubscription(id),
    onSuccess: () => {
      toast.success("Device removed");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Couldn't remove device"),
  });

  const devices = devicesQuery.data ?? [];

  return (
    <section className="flex flex-col gap-4 rounded-card border border-brand-border bg-brand-card p-4">
      <div>
        <h2 className="text-base font-bold text-brand-navy">Push Notification Status</h2>
        <p className="mt-1 text-sm text-brand-text-muted">
          Push notifications for dose reminders are delivered by the RxTracker Android app.
          This web app doesn&apos;t register its own push subscription — the devices below are
          whatever the mobile app has registered for your account. You can remove a device
          here if you no longer use it; to add one, sign in on the mobile app.
        </p>
      </div>

      {devicesQuery.isLoading ? (
        <p className="text-sm text-brand-text-muted">Loading…</p>
      ) : devices.length === 0 ? (
        <p className="text-sm text-brand-text-muted">
          No devices registered for push notifications yet. Install and sign in to the RxTracker
          Android app to start receiving push reminders.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {devices.map((device: PushSubscriptionRow) => (
            <li
              key={device.id}
              className="flex items-center justify-between gap-3 rounded-control border border-brand-border px-3 py-2"
            >
              <span className="flex items-center gap-2 text-sm text-brand-text">
                <Smartphone size={16} className="shrink-0 text-brand-text-muted" />
                <span>
                  <span className="block font-medium">
                    {device.device_name || "Unnamed device"}
                  </span>
                  <span className="block text-xs text-brand-text-muted">
                    Registered {new Date(device.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </span>
              </span>
              <Button
                type="button"
                variant="secondary"
                size="compact"
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate(device.id)}
                className="shrink-0"
              >
                <Trash2 size={14} />
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function HelpPanel() {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-brand-border bg-brand-card p-4">
      <h2 className="text-base font-bold text-brand-navy">Help &amp; Documentation</h2>
      <p className="text-sm text-brand-text-muted">
        Answers to common questions about reminders, inventory tracking, adherence, and
        exporting a doctor visit report.
      </p>
      <Link
        href="/help"
        className="inline-flex w-fit items-center gap-2 rounded-control border border-brand-border bg-white px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-bg"
      >
        <HelpCircle size={16} />
        View Help &amp; FAQ
      </Link>
    </section>
  );
}
