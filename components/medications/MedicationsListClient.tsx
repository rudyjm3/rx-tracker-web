"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Layers } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import {
  getActiveMedications,
  getGroupMembers,
  getGroups,
  getInactiveMedications,
  reorderMedications,
} from "@/lib/medications";
import { deleteDraft, getDrafts } from "@/lib/drafts";
import { Button, buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { to12h } from "@/lib/utils";
import type { Medication, MedicationType } from "@/lib/types/medications";
import { MedicationCard } from "./MedicationCard";
import { SortableMedicationCard } from "./SortableMedicationCard";
import { GroupCard } from "./GroupCard";
import { GroupModal } from "./GroupModal";
import { MedicationTypeFilter } from "./MedicationTypeFilter";

type Tab = "active" | "inactive" | "groups";

const ALL_TYPES: Set<MedicationType> = new Set(["prescription", "otc", "supplement"]);

export function MedicationsListClient() {
  const queryClient = useQueryClient();
  const { activeProfileId, isResolving } = useActiveProfile();
  const [tab, setTab] = useState<Tab>("active");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [typeFilter, setTypeFilter] = useState<Set<MedicationType>>(ALL_TYPES);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const activeQuery = useQuery({
    queryKey: ["medications", "active", activeProfileId],
    queryFn: () => getActiveMedications(activeProfileId),
    enabled: !isResolving,
  });
  const inactiveQuery = useQuery({
    queryKey: ["medications", "inactive", activeProfileId],
    queryFn: () => getInactiveMedications(activeProfileId),
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
  const draftsQuery = useQuery({
    queryKey: ["drafts", activeProfileId],
    queryFn: () => getDrafts(activeProfileId),
    enabled: !isResolving,
  });

  const discardDraftMutation = useMutation({
    mutationFn: (id: string) => deleteDraft(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => reorderMedications(orderedIds),
    // Optimistic update — reflect the new order immediately without
    // waiting on the round trip, so the drag doesn't visually snap back
    // before the mutation resolves.
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: ["medications", "active", activeProfileId] });
      const previous = queryClient.getQueryData<Medication[]>([
        "medications",
        "active",
        activeProfileId,
      ]);
      if (previous) {
        const byId = new Map(previous.map((m) => [m.id, m]));
        const reordered = orderedIds
          .map((id) => byId.get(id))
          .filter((m): m is Medication => Boolean(m));
        const untouched = previous.filter((m) => !orderedIds.includes(m.id));
        queryClient.setQueryData(
          ["medications", "active", activeProfileId],
          [...reordered, ...untouched],
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["medications", "active", activeProfileId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["medications", "active", activeProfileId] });
    },
  });

  const activeMedications = useMemo(() => activeQuery.data ?? [], [activeQuery.data]);
  const inactiveMedications = useMemo(() => inactiveQuery.data ?? [], [inactiveQuery.data]);
  const groups = groupsQuery.data ?? [];
  // getGroupMembers() returns memberships for every group regardless of
  // its active flag — deleteGroup() only soft-deletes the group row, it
  // doesn't remove membership rows. Filter to active groups here so a
  // deleted group's medications reappear as ungrouped instead of
  // vanishing (excluded from "ungrouped" but never rendered under any
  // group, since only active groups are iterated below).
  const activeGroupIds = new Set(groups.map((g) => g.id));
  const groupMembers = (groupMembersQuery.data ?? []).filter((m) =>
    activeGroupIds.has(m.group_id),
  );

  const groupedMedicationIds = new Set(groupMembers.map((m) => m.medication_id));
  const ungroupedMedications = activeMedications.filter(
    (m) => !groupedMedicationIds.has(m.id),
  );

  const filteredActiveMedications = useMemo(
    () => activeMedications.filter((m) => typeFilter.has(m.medication_type)),
    [activeMedications, typeFilter],
  );
  const filteredInactiveMedications = useMemo(
    () => inactiveMedications.filter((m) => typeFilter.has(m.medication_type)),
    [inactiveMedications, typeFilter],
  );
  const filteredUngroupedMedications = useMemo(
    () => ungroupedMedications.filter((m) => typeFilter.has(m.medication_type)),
    [ungroupedMedications, typeFilter],
  );

  if (isResolving || activeQuery.isLoading) {
    return <p className="text-brand-text-muted">Loading medications…</p>;
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "active", label: "Active", count: activeMedications.length },
    { key: "inactive", label: "Inactive", count: inactiveMedications.length },
    { key: "groups", label: "Groups", count: groups.length },
  ];

  function groupDoseOverridesFor(medicationId: string) {
    return groupMembers
      .filter((member) => member.medication_id === medicationId)
      .flatMap((member) => {
        const group = groups.find((item) => item.id === member.group_id);
        return group
          ? [{ scheduled_time: group.scheduled_time, quantity_per_dose: member.quantity_per_dose }]
          : [];
      });
  }

  function membersOf(groupId: string) {
    const memberIds = groupMembers
      .filter((m) => m.group_id === groupId)
      .map((m) => m.medication_id);
    return activeMedications.filter((m) => memberIds.includes(m.id));
  }

  function handleUngroupedDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = filteredUngroupedMedications.map((m) => m.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...ids];
    reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, String(active.id));
    // Ungrouped-only reorder writes sequential sort_order values starting
    // at 0 across just this filtered subset — grouped medications keep
    // whatever sort_order they already had, since they're never part of
    // this drag context.
    reorderMutation.mutate(reordered);
  }

  return (
    <div className="flex flex-col gap-6">
      {draftsQuery.data && draftsQuery.data.length > 0 && (
        <div className="flex flex-col gap-2 rounded-card border border-status-warning/40 bg-status-warning/10 p-4">
          <span className="text-sm font-medium text-brand-text">
            You have unfinished medications
          </span>
          {draftsQuery.data.map((draft) => (
            <div key={draft.id} className="flex items-center justify-between">
              <span className="text-sm text-brand-text-muted">
                Draft updated {new Date(draft.updatedAt).toLocaleString()}
              </span>
              <div className="flex gap-2">
                <Link
                  href={`/medications/new?draft=${draft.id}`}
                  className="text-sm font-medium text-brand-deep-blue hover:underline"
                >
                  Continue
                </Link>
                <button
                  type="button"
                  onClick={() => discardDraftMutation.mutate(draft.id)}
                  className="text-sm text-status-danger hover:underline"
                >
                  Discard
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-control px-4 py-2 text-sm font-semibold transition-opacity",
                tab === t.key
                  ? "bg-gradient-brand text-white shadow-card"
                  : "border border-brand-border bg-white text-brand-navy hover:bg-brand-bg",
              )}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {tab !== "groups" && (
            <MedicationTypeFilter selected={typeFilter} onApply={setTypeFilter} />
          )}
          <Link href="/medications/new" className={cn(buttonVariants())}>
            + Add medication
          </Link>
        </div>
      </div>

      {tab === "active" &&
        (activeMedications.length === 0 ? (
          <p className="text-brand-text-muted">
            No medications yet. Add your first one to get started.
          </p>
        ) : filteredActiveMedications.length === 0 ? (
          <p className="text-brand-text-muted">
            No medications match the selected filter.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((group) => {
              const members = membersOf(group.id).filter((m) =>
                typeFilter.has(m.medication_type),
              );
              if (members.length === 0) return null;
              return (
                <div key={group.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 px-1 text-sm font-semibold text-brand-text-muted">
                    <Layers size={14} />
                    {group.name} · {to12h(group.scheduled_time.slice(0, 5))}
                  </div>
                  {members.map((med) => (
                    <MedicationCard
                      key={med.id}
                      medication={med}
                      groupDoseOverrides={groupDoseOverridesFor(med.id)}
                    />
                  ))}
                </div>
              );
            })}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleUngroupedDragEnd}
            >
              <SortableContext
                items={filteredUngroupedMedications.map((m) => m.id)}
                strategy={verticalListSortingStrategy}
              >
                {filteredUngroupedMedications.map((med) => (
                  <SortableMedicationCard key={med.id} medication={med} />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        ))}

      {tab === "inactive" &&
        (inactiveMedications.length === 0 ? (
          <p className="text-brand-text-muted">No inactive medications.</p>
        ) : filteredInactiveMedications.length === 0 ? (
          <p className="text-brand-text-muted">
            No medications match the selected filter.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredInactiveMedications.map((med) => (
              <MedicationCard key={med.id} medication={med} />
            ))}
          </div>
        ))}

      {tab === "groups" && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setCreatingGroup(true)}>
              + New group
            </Button>
          </div>
          {groups.length === 0 ? (
            <p className="text-brand-text-muted">
              No groups yet. Create one to bundle medications taken together.
            </p>
          ) : (
            groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                members={membersOf(group.id)}
                memberOverrides={groupMembers.filter((m) => m.group_id === group.id)}
                allActiveMedications={activeMedications}
              />
            ))
          )}
        </div>
      )}

      <GroupModal
        open={creatingGroup}
        onOpenChange={setCreatingGroup}
        availableMedications={activeMedications}
      />
    </div>
  );
}
