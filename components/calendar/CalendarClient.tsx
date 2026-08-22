"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import { getMissedGraceMinutes } from "@/lib/app-settings";
import {
  backfillMonth,
  buildDayDetails,
  monthBounds,
  type CalendarDayDetail,
  type CalendarDaySlot,
} from "@/lib/calendar";
import { getCalendarLogs, getCalendarMarkers } from "@/lib/dose-logs";
import {
  getActiveMedications,
  getGroupMembers,
  getGroups,
  getInactiveMedications,
  getStatusEvents,
} from "@/lib/medications";
import { localDateString } from "@/lib/utils";
import { MonthGrid } from "./MonthGrid";
import { DayDetailDialog } from "./DayDetailDialog";
import { EditDoseLogDialog, type EditableDoseLog } from "@/components/history/EditDoseLogDialog";

function currentMonth(): string {
  return localDateString().slice(0, 7);
}

export function CalendarClient() {
  const queryClient = useQueryClient();
  const { activeProfileId } = useActiveProfile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const month = searchParams.get("m") ?? currentMonth();
  const bounds = monthBounds(month);
  const todayDate = localDateString();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<CalendarDaySlot | null>(null);

  function navigateToMonth(nextMonth: string) {
    const params = new URLSearchParams(searchParams);
    params.set("m", nextMonth);
    router.push(`/calendar?${params.toString()}`);
  }

  const activeMedicationsQuery = useQuery({
    queryKey: ["medications", "active", activeProfileId],
    queryFn: () => getActiveMedications(activeProfileId),
  });
  const inactiveMedicationsQuery = useQuery({
    queryKey: ["medications", "inactive", activeProfileId],
    queryFn: () => getInactiveMedications(activeProfileId),
  });
  const groupsQuery = useQuery({
    queryKey: ["groups", activeProfileId],
    queryFn: () => getGroups(activeProfileId),
  });
  const groupMembersQuery = useQuery({
    queryKey: ["group-members"],
    queryFn: getGroupMembers,
  });
  const graceQuery = useQuery({
    queryKey: ["app-settings", "missed_grace_minutes"],
    queryFn: getMissedGraceMinutes,
  });

  // Covers active *and* inactive medications: a medication can be
  // discontinued and later resumed, so its being active right now
  // doesn't mean it was active for every past date — backfillMonth
  // checks each active medication's own history too, not just inactive
  // ones (see lib/calendar.ts).
  const allMedicationIds = useMemo(
    () => [
      ...(activeMedicationsQuery.data ?? []).map((m) => m.id),
      ...(inactiveMedicationsQuery.data ?? []).map((m) => m.id),
    ],
    [activeMedicationsQuery.data, inactiveMedicationsQuery.data],
  );
  const medicationListsLoaded =
    activeMedicationsQuery.data !== undefined && inactiveMedicationsQuery.data !== undefined;
  const statusEventsQuery = useQuery({
    queryKey: ["medication-status-events", allMedicationIds],
    queryFn: () => getStatusEvents(allMedicationIds),
    enabled: medicationListsLoaded,
  });

  const markersQuery = useQuery({
    queryKey: ["calendar-markers", bounds.monthStart, bounds.monthEnd, allMedicationIds],
    queryFn: () => getCalendarMarkers(bounds.monthStart, bounds.monthEnd, allMedicationIds),
    enabled: medicationListsLoaded,
  });
  const logsQuery = useQuery({
    queryKey: ["calendar-logs", bounds.monthStart, bounds.monthEnd, allMedicationIds],
    queryFn: () => getCalendarLogs(bounds.monthStart, bounds.monthEnd, allMedicationIds),
    enabled: medicationListsLoaded,
  });

  const graceMinutes = graceQuery.data ?? 60;

  // Re-finalize missed doses for every past date in the visible month
  // (including for medications discontinued partway through it), so
  // days aren't left permanently blank just because nobody had the app
  // open that day. Only invalidate when something actually changed, to
  // avoid the refetch-invalidate loop fixed on the dashboard (PR #3).
  useEffect(() => {
    if (
      !activeMedicationsQuery.data ||
      !inactiveMedicationsQuery.data ||
      !statusEventsQuery.data ||
      graceQuery.data == null
    ) {
      return;
    }
    let cancelled = false;
    backfillMonth(
      bounds.monthStart,
      bounds.monthEnd,
      todayDate,
      activeMedicationsQuery.data,
      inactiveMedicationsQuery.data,
      groupsQuery.data ?? [],
      groupMembersQuery.data ?? [],
      statusEventsQuery.data,
      graceMinutes,
    )
      .then((didFinalize) => {
        if (!cancelled && didFinalize) {
          queryClient.invalidateQueries({
            queryKey: ["calendar-markers", bounds.monthStart, bounds.monthEnd],
          });
          queryClient.invalidateQueries({
            queryKey: ["calendar-logs", bounds.monthStart, bounds.monthEnd],
          });
        }
      })
      .catch(() => {
        // Best-effort — a transient failure just means this month's
        // backfill retries on the next load.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    bounds.monthStart,
    bounds.monthEnd,
    todayDate,
    activeMedicationsQuery.data,
    inactiveMedicationsQuery.data,
    statusEventsQuery.data,
    graceQuery.data,
  ]);

  const dayDetails = useMemo<Record<string, CalendarDayDetail>>(() => {
    if (!logsQuery.data) return {};
    return buildDayDetails(logsQuery.data, graceMinutes);
  }, [logsQuery.data, graceMinutes]);

  const allMedications = useMemo(
    () => [...(activeMedicationsQuery.data ?? []), ...(inactiveMedicationsQuery.data ?? [])],
    [activeMedicationsQuery.data, inactiveMedicationsQuery.data],
  );
  const editingMedication = editingSlot
    ? (allMedications.find((m) => m.id === editingSlot.medicationId) ?? null)
    : null;
  const editingLog: EditableDoseLog | null =
    editingSlot && selectedDate
      ? {
          id: editingSlot.logId,
          status: editingSlot.status,
          scheduledForDate: selectedDate,
          takenAt: editingSlot.takenAt,
          painLevel: editingSlot.painLevel,
          moodLevel: editingSlot.moodLevel,
          note: editingSlot.note,
          deductedQuantity: editingSlot.deductedQuantity,
        }
      : null;

  function refreshCalendarData() {
    queryClient.invalidateQueries({
      queryKey: ["calendar-markers", bounds.monthStart, bounds.monthEnd],
    });
    queryClient.invalidateQueries({
      queryKey: ["calendar-logs", bounds.monthStart, bounds.monthEnd],
    });
  }

  const isLoading =
    activeMedicationsQuery.isLoading ||
    inactiveMedicationsQuery.isLoading ||
    groupsQuery.isLoading ||
    groupMembersQuery.isLoading ||
    markersQuery.isLoading ||
    logsQuery.isLoading;

  if (isLoading) {
    return <p className="text-brand-text-muted">Loading calendar…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <MonthGrid
        month={month}
        todayDate={todayDate}
        markers={markersQuery.data ?? {}}
        hasDetail={(date) => date in dayDetails}
        onNavigate={navigateToMonth}
        onSelectDay={setSelectedDate}
      />
      <DayDetailDialog
        day={selectedDate ? (dayDetails[selectedDate] ?? null) : null}
        onClose={() => setSelectedDate(null)}
        onEditSlot={setEditingSlot}
      />
      <EditDoseLogDialog
        log={editingLog}
        medication={editingMedication}
        onClose={() => setEditingSlot(null)}
        onSaved={() => {
          toast.success("Dose entry updated");
          setEditingSlot(null);
          refreshCalendarData();
        }}
        onDeleted={() => {
          toast.success("Dose entry deleted");
          setEditingSlot(null);
          refreshCalendarData();
        }}
      />
    </div>
  );
}
