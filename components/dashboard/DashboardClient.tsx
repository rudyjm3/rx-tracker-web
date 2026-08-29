"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays } from "lucide-react";
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
import { computeAdherenceStats } from "@/lib/adherence";
import { playAlarmSound, triggerVibration } from "@/lib/notifications";
import {
  buildDoseEvents,
  generateDaySlots,
  slotDueTime,
  type DaySlot,
  type NextDoseEvent,
} from "@/lib/schedule";
import { isLate, localDateString } from "@/lib/utils";
import { HeroPanel } from "./HeroPanel";
import { ScheduleList } from "./ScheduleList";
import { LowSupplyBanner } from "./LowSupplyBanner";
import { SetupCompleteBanner } from "./SetupCompleteBanner";
import { FeedbackDialog } from "./FeedbackDialog";
import { PwaInstallBanner } from "./PwaInstallBanner";
import { QuickActionsPanel } from "./QuickActionsPanel";
import { MedsOverviewPanel } from "./MedsOverviewPanel";
import { TodayHistoryPanel } from "./TodayHistoryPanel";
import { RequiredDosesModal } from "./RequiredDosesModal";
import { AlarmOverlay } from "./AlarmOverlay";

const REFRESH_INTERVAL_MS = 60_000;
const todayString = localDateString;

export function DashboardClient({ setupComplete = false }: { setupComplete?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeProfileId, isResolving } = useActiveProfile();
  const [date, setDate] = useState(todayString);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  // A queue, not a single slot: taking every member of a group at once
  // (bulk "Take Now" from the Alarm Overlay) can hit several medications
  // that each need feedback, and each needs its own turn at the dialog
  // rather than the last one silently winning.
  const [feedbackQueue, setFeedbackQueue] = useState<DaySlot[]>([]);
  const feedbackSlot = feedbackQueue[0] ?? null;
  // High-water mark of the current feedback batch's size, so the dialog
  // can show "2 of 3" instead of a shrinking-only "3 left, 2 left, 1
  // left" — kept in state (not a ref) and synced via effect rather than
  // computed during render, since render must stay pure.
  const [feedbackBatchTotal, setFeedbackBatchTotal] = useState(feedbackQueue.length);
  const [lastQueueLength, setLastQueueLength] = useState(feedbackQueue.length);
  if (feedbackQueue.length !== lastQueueLength) {
    setLastQueueLength(feedbackQueue.length);
    setFeedbackBatchTotal(
      feedbackQueue.length === 0 ? 0 : Math.max(feedbackBatchTotal, feedbackQueue.length),
    );
  }

  // Current time as state (not a raw Date.now() read during render, which
  // would make this component impure) — refreshed every 20s by the
  // interval below, and read here (and in dueNowEvent) to decide what's
  // due right now.
  const [nowTick, setNowTick] = useState(() => Date.now());

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
      setFeedbackQueue((q) => [...q, slot]);
      return;
    }
    setPendingKey(`${slot.medicationId}|${slot.scheduledTime}`);
    takeMutation.mutate({ slot });
  }
  function handleFeedbackSubmit(feedback?: DoseFeedback) {
    const slot = feedbackQueue[0];
    if (!slot) return;
    setFeedbackQueue((q) => q.slice(1));
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

  function eventSlots(event: NextDoseEvent): DaySlot[] {
    return event.kind === "group" ? event.members : [event.slot];
  }
  function handleTakeAll(event: NextDoseEvent) {
    eventSlots(event).forEach(handleTake);
  }
  function handleSkipAll(event: NextDoseEvent) {
    eventSlots(event).forEach(handleSkip);
  }
  function handleSnoozeAll(event: NextDoseEvent, minutes: number) {
    eventSlots(event).forEach((slot) => handleSnooze(slot, minutes));
  }

  const effectiveTime = (slot: DaySlot) => slotDueTime(slot, date);

  const doseEvents = useMemo(
    () => buildDoseEvents(slots.filter((s) => s.status === "pending"), date),
    [slots, date],
  );

  // The earliest pending event whose due time has already passed but
  // hasn't yet crossed the missed-dose grace cutoff — the same window
  // finalizeMissedDoses/the sound alert below use, so the overlay only
  // ever covers a slot that's genuinely still actionable.
  const dueNowEvent =
    doseEvents.find((e) => e.time <= nowTick && nowTick <= e.time + graceMinutes * 60_000) ?? null;

  const adherenceStats = computeAdherenceStats(
    slots
      .filter((s) => s.status !== "pending" && s.medication.adherence_enabled && !s.isPrn)
      .map((s) => ({
        status: s.status as "taken" | "skipped" | "missed",
        late: isLate(
          { status: s.status, taken_at: s.takenAt, scheduled_for_date: date, scheduled_time: s.scheduledTime },
          graceMinutes,
        ),
      })),
  );

  const [requiredDosesOpen, setRequiredDosesOpen] = useState(false);
  const todaysDosesCount = slots.length;
  const dosesTaken = slots.filter((s) => s.status === "taken").length;
  const dosesMissed = slots.filter((s) => s.status === "missed").length;

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
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 20_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const now = nowTick;
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
  }, [slots, date, graceMinutes, nowTick]);

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

  const todayLabel = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const feedbackQueuePosition = feedbackBatchTotal - feedbackQueue.length + 1;

  return (
    <div className="flex flex-col gap-6">
      {showSetupBanner && <SetupCompleteBanner />}
      <LowSupplyBanner medications={medicationsQuery.data ?? []} />

      <HeroPanel events={doseEvents} adherenceStats={adherenceStats} />

      <PwaInstallBanner />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-card border border-brand-border bg-brand-card p-4 shadow-card sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-brand-navy">Today schedule</h2>
              <span className="rounded-full bg-brand-bg px-2 py-0.5 text-xs text-brand-text-muted">
                {todayLabel}
              </span>
            </div>
            <Link
              href="/calendar"
              className="flex items-center gap-1 text-sm font-medium text-brand-deep-blue hover:underline"
            >
              <CalendarDays size={14} />
              View calendar
            </Link>
          </div>
          <div className="max-h-[28rem] overflow-y-auto pr-1">
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
          <Link
            href="/calendar"
            className="mt-3 block text-center text-sm font-medium text-brand-deep-blue hover:underline"
          >
            View full schedule
          </Link>
        </div>

        <div className="flex flex-col gap-6">
          <QuickActionsPanel />
          <MedsOverviewPanel
            activeCount={medicationsQuery.data?.length ?? 0}
            todaysDosesCount={todaysDosesCount}
            dosesTaken={dosesTaken}
            dosesMissed={dosesMissed}
            onViewRequiredDoses={() => setRequiredDosesOpen(true)}
          />
        </div>
      </div>

      <TodayHistoryPanel date={date} medications={medicationsQuery.data ?? []} />

      <FeedbackDialog
        slot={feedbackSlot}
        queuePosition={feedbackQueuePosition}
        queueTotal={feedbackBatchTotal}
        onSubmit={handleFeedbackSubmit}
        onClose={() => setFeedbackQueue((q) => q.slice(1))}
      />
      <RequiredDosesModal
        open={requiredDosesOpen}
        onClose={() => setRequiredDosesOpen(false)}
        slots={slots}
      />
      <AlarmOverlay
        event={dueNowEvent}
        onTakeAll={() => dueNowEvent && handleTakeAll(dueNowEvent)}
        onSkipAll={() => dueNowEvent && handleSkipAll(dueNowEvent)}
        onSnoozeAll={(minutes) => dueNowEvent && handleSnoozeAll(dueNowEvent, minutes)}
        onTakeOne={handleTake}
        onSkipOne={handleSkip}
        onSnoozeOne={handleSnooze}
        defaultSnoozeMinutes={snoozeSettingQuery.data}
        disabled={pendingKey !== null}
      />
    </div>
  );
}
