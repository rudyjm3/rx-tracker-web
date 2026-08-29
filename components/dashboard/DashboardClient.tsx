"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { getMissedGraceMinutes, getSnoozeMinutes } from "@/lib/app-settings";
import {
  finalizeMissedDoses,
  getTodayLogs,
  getTodayPostpones,
  postponeDose,
  recordDose,
  type DoseFeedback,
} from "@/lib/dose-logs";
import {
  getActiveMedications,
  getGroupMembers,
  getGroups,
} from "@/lib/medications";
import { computeAdherence } from "@/lib/adherence";
import { playAlarmSound, triggerVibration } from "@/lib/notifications";
import { generateDaySlots, type DaySlot } from "@/lib/schedule";
import { localDateString } from "@/lib/utils";
import type { DoseLogStatus } from "@/lib/types/medications";
import { HeroPanel } from "./HeroPanel";
import { ScheduleList } from "./ScheduleList";
import { LowSupplyBanner } from "./LowSupplyBanner";
import { SetupCompleteBanner } from "./SetupCompleteBanner";
import { FeedbackDialog } from "./FeedbackDialog";

const REFRESH_INTERVAL_MS = 60_000;
const todayString = localDateString;

export function DashboardClient({ setupComplete = false }: { setupComplete?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeProfileId, isResolving } = useActiveProfile();
  const [date, setDate] = useState(todayString);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [feedbackSlot, setFeedbackSlot] = useState<DaySlot | null>(null);

  // Captured once into state rather than read directly from the prop:
  // the router.replace below causes the server component to re-render
  // with setupComplete=false almost immediately (often before the
  // loading gate below even clears), and reading the prop directly at
  // render time would make the banner disappear before it was ever
  // visible. This snapshot keeps it showing for this mount regardless of
  // when the URL-stripping replace resolves.
  const [showSetupBanner] = useState(setupComplete);

  // Strip ?setup=complete after the first render so a refresh doesn't
  // re-show the one-time banner.
  const hasStrippedSetupParam = useRef(false);
  useEffect(() => {
    if (!setupComplete || hasStrippedSetupParam.current) return;
    hasStrippedSetupParam.current = true;
    router.replace("/dashboard");
  }, [setupComplete, router]);

  // A dashboard left open across local midnight would otherwise keep
  // refetching/recording against the frozen initial date forever.
  useEffect(() => {
    const id = setInterval(() => {
      setDate((current) => {
        const now = todayString();
        return now === current ? current : now;
      });
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const medicationsQuery = useQuery({
    queryKey: ["medications", "active", activeProfileId],
    queryFn: () => getActiveMedications(activeProfileId),
    refetchInterval: REFRESH_INTERVAL_MS,
    enabled: !isResolving,
  });
  const groupsQuery = useQuery({
    queryKey: ["groups", activeProfileId],
    queryFn: () => getGroups(activeProfileId),
    enabled: !isResolving,
  });
  const groupMembersQuery = useQuery({
    queryKey: ["group-members"],
    queryFn: getGroupMembers,
  });
  const logsQuery = useQuery({
    queryKey: ["dose-logs", date],
    queryFn: () => getTodayLogs(date),
    refetchInterval: REFRESH_INTERVAL_MS,
  });
  const postponesQuery = useQuery({
    queryKey: ["dose-postpones", date],
    queryFn: () => getTodayPostpones(date),
    refetchInterval: REFRESH_INTERVAL_MS,
  });
  const graceQuery = useQuery({
    queryKey: ["app-settings", "missed_grace_minutes"],
    queryFn: getMissedGraceMinutes,
  });
  const snoozeSettingQuery = useQuery({
    queryKey: ["app-settings", "snooze_minutes"],
    queryFn: getSnoozeMinutes,
  });

  const slots = useMemo<DaySlot[]>(() => {
    if (!medicationsQuery.data || !logsQuery.data || !postponesQuery.data) {
      return [];
    }
    return generateDaySlots(
      date,
      medicationsQuery.data,
      groupsQuery.data ?? [],
      groupMembersQuery.data ?? [],
      logsQuery.data,
      postponesQuery.data,
    );
  }, [
    date,
    medicationsQuery.data,
    groupsQuery.data,
    groupMembersQuery.data,
    logsQuery.data,
    postponesQuery.data,
  ]);

  const graceMinutes = graceQuery.data ?? 60;

  // Finalize missed doses once slots/grace are available, then whenever
  // the underlying data changes (new medications, a new day, etc.).
  useEffect(() => {
    if (slots.length === 0 || graceQuery.data == null) return;
    let cancelled = false;
    finalizeMissedDoses(date, slots, graceMinutes)
      .then((didFinalize) => {
        if (!cancelled && didFinalize) {
          queryClient.invalidateQueries({ queryKey: ["dose-logs", date] });
        }
      })
      .catch(() => {
        // Best-effort — a transient failure here just means missed
        // doses get finalized on the next load/refresh instead.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, graceQuery.data, logsQuery.dataUpdatedAt]);

  const takeMutation = useMutation({
    mutationFn: ({ slot, feedback }: { slot: DaySlot; feedback?: DoseFeedback }) =>
      recordDose(slot.medication, date, slot.scheduledTime, "taken", slot.quantityPerDose, feedback),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dose-logs", date] });
      queryClient.invalidateQueries({ queryKey: ["medications"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't record dose");
    },
    onSettled: () => setPendingKey(null),
  });

  const skipMutation = useMutation({
    mutationFn: (slot: DaySlot) =>
      recordDose(slot.medication, date, slot.scheduledTime, "skipped", slot.quantityPerDose),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dose-logs", date] });
      queryClient.invalidateQueries({ queryKey: ["medications"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't record dose");
    },
    onSettled: () => setPendingKey(null),
  });

  const snoozeMutation = useMutation({
    mutationFn: ({ slot, minutes }: { slot: DaySlot; minutes: number }) =>
      postponeDose(slot.medicationId, date, slot.scheduledTime, minutes),
    onSuccess: (_, { minutes }) => {
      toast.success(`Snoozed for ${minutes} minutes`);
      queryClient.invalidateQueries({ queryKey: ["dose-postpones", date] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't snooze dose");
    },
    onSettled: () => setPendingKey(null),
  });

  function handleTake(slot: DaySlot) {
    if (slot.medication.feedback_type !== "none") {
      setFeedbackSlot(slot);
      return;
    }
    setPendingKey(`${slot.medicationId}|${slot.scheduledTime}`);
    takeMutation.mutate({ slot });
  }
  function handleFeedbackSubmit(feedback?: DoseFeedback) {
    if (!feedbackSlot) return;
    const slot = feedbackSlot;
    setFeedbackSlot(null);
    setPendingKey(`${slot.medicationId}|${slot.scheduledTime}`);
    takeMutation.mutate({ slot, feedback });
  }
  function handleSkip(slot: DaySlot) {
    setPendingKey(`${slot.medicationId}|${slot.scheduledTime}`);
    skipMutation.mutate(slot);
  }
  function handleSnooze(slot: DaySlot, minutes: number) {
    setPendingKey(`${slot.medicationId}|${slot.scheduledTime}`);
    snoozeMutation.mutate({ slot, minutes });
  }

  const effectiveTime = (slot: DaySlot) =>
    slot.postponedUntil
      ? new Date(slot.postponedUntil).getTime()
      : new Date(`${date}T${slot.scheduledTime}`).getTime();

  const nextDose =
    slots
      .filter((s) => s.status === "pending")
      .sort((a, b) => effectiveTime(a) - effectiveTime(b))[0] ?? null;

  const adherencePercent = computeAdherence(
    slots
      .filter((s) => s.status !== "pending" && s.medication.adherence_enabled)
      .map((s) => ({ status: s.status as DoseLogStatus })),
  );

  // In-app "dose due" alert: fires once per slot, keyed by its exact due
  // time (effectiveTime) rather than its scheduled time, so a later
  // snooze — which changes that time — can alarm again instead of being
  // permanently suppressed by the first alarm's key. Only alarms while
  // the due time has passed but the missed-dose grace cutoff hasn't, so
  // a backlog of already-overdue-past-grace slots doesn't all alarm at
  // once on load — those are about to be finalized as missed by the
  // effect above instead. Driven by its own tick, not just `slots`
  // changing reference: React Query structurally shares unchanged
  // refetch results, so `slots` can keep the same object reference
  // across a full poll cycle even once a slot's due time has newly
  // passed, and this effect wouldn't otherwise re-run to notice.
  const alarmedKeysRef = useRef<Set<string>>(new Set());
  const [alarmTick, setAlarmTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setAlarmTick((t) => t + 1), 20_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const now = Date.now();
    for (const slot of slots) {
      if (slot.status !== "pending") continue;
      const due = effectiveTime(slot);
      if (due > now) continue;
      if (now > due + graceMinutes * 60_000) continue;
      const key = `${slot.medicationId}|${due}`;
      if (alarmedKeysRef.current.has(key)) continue;
      alarmedKeysRef.current.add(key);
      playAlarmSound();
      triggerVibration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, date, graceMinutes, alarmTick]);

  const isLoading =
    isResolving ||
    medicationsQuery.isLoading ||
    groupsQuery.isLoading ||
    groupMembersQuery.isLoading ||
    logsQuery.isLoading ||
    postponesQuery.isLoading;

  if (isLoading) {
    return <p className="text-brand-text-muted">Loading dashboard…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {showSetupBanner && <SetupCompleteBanner />}
      <LowSupplyBanner medications={medicationsQuery.data ?? []} />

      <HeroPanel
        nextDose={nextDose}
        adherencePercent={adherencePercent}
        onTake={handleTake}
        onSkip={handleSkip}
        onSnooze={handleSnooze}
        defaultSnoozeMinutes={snoozeSettingQuery.data}
        disabled={pendingKey !== null}
      />

      <div>
        <h2 className="mb-3 text-lg font-bold text-brand-navy">
          Today&apos;s schedule
        </h2>
        <ScheduleList
          slots={slots}
          date={date}
          graceMinutes={graceMinutes}
          onTake={handleTake}
          onSkip={handleSkip}
          onSnooze={handleSnooze}
          defaultSnoozeMinutes={snoozeSettingQuery.data}
          pendingKey={pendingKey}
        />
      </div>

      <FeedbackDialog
        slot={feedbackSlot}
        onSubmit={handleFeedbackSubmit}
        onClose={() => setFeedbackSlot(null)}
      />
    </div>
  );
}
