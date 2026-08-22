"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getMissedGraceMinutes } from "@/lib/app-settings";
import {
  finalizeMissedDoses,
  getTodayLogs,
  getTodayPostpones,
  postponeDose,
  recordDose,
} from "@/lib/dose-logs";
import {
  getActiveMedications,
  getGroupMembers,
  getGroups,
} from "@/lib/medications";
import { computeAdherence } from "@/lib/adherence";
import { generateDaySlots, type DaySlot } from "@/lib/schedule";
import type { DoseLogStatus } from "@/lib/types/medications";
import { HeroPanel } from "./HeroPanel";
import { ScheduleList } from "./ScheduleList";
import { LowSupplyBanner } from "./LowSupplyBanner";

const REFRESH_INTERVAL_MS = 60_000;

// Local calendar date, not UTC — toISOString() would shift the date
// for any user not on UTC, especially for several hours around local
// midnight (e.g. a UTC-7 user sees tomorrow's date after 5pm local).
function todayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DashboardClient() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayString);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

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
    queryKey: ["medications", "active"],
    queryFn: getActiveMedications,
    refetchInterval: REFRESH_INTERVAL_MS,
  });
  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: getGroups });
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
    mutationFn: (slot: DaySlot) =>
      recordDose(slot.medication, date, slot.scheduledTime, "taken", slot.quantityPerDose),
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
    setPendingKey(`${slot.medicationId}|${slot.scheduledTime}`);
    takeMutation.mutate(slot);
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

  const isLoading =
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
      <LowSupplyBanner medications={medicationsQuery.data ?? []} />

      <HeroPanel
        nextDose={nextDose}
        adherencePercent={adherencePercent}
        onTake={handleTake}
        onSkip={handleSkip}
        onSnooze={handleSnooze}
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
          pendingKey={pendingKey}
        />
      </div>
    </div>
  );
}
