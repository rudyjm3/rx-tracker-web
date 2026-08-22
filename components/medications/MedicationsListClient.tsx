"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveProfile } from "@/components/layout/ActiveProfileProvider";
import {
  getActiveMedications,
  getGroupMembers,
  getGroups,
  getInactiveMedications,
} from "@/lib/medications";
import { deleteDraft, getDrafts } from "@/lib/drafts";
import { Button, buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { MedicationCard } from "./MedicationCard";
import { GroupCard } from "./GroupCard";
import { GroupModal } from "./GroupModal";

export function MedicationsListClient() {
  const queryClient = useQueryClient();
  const { activeProfileId } = useActiveProfile();
  const [showInactive, setShowInactive] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const activeQuery = useQuery({
    queryKey: ["medications", "active", activeProfileId],
    queryFn: () => getActiveMedications(activeProfileId),
  });
  const inactiveQuery = useQuery({
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
  const draftsQuery = useQuery({
    queryKey: ["drafts", activeProfileId],
    queryFn: () => getDrafts(activeProfileId),
  });

  const discardDraftMutation = useMutation({
    mutationFn: (id: string) => deleteDraft(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
    },
  });

  const activeMedications = activeQuery.data ?? [];
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

  if (activeQuery.isLoading) {
    return <p className="text-brand-text-muted">Loading medications…</p>;
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

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setCreatingGroup(true)}>
          + New group
        </Button>
        <Link href="/medications/new" className={cn(buttonVariants())}>
          + Add medication
        </Link>
      </div>

      {activeMedications.length === 0 ? (
        <p className="text-brand-text-muted">
          No medications yet. Add your first one to get started.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => {
            const memberIds = groupMembers
              .filter((m) => m.group_id === group.id)
              .map((m) => m.medication_id);
            const members = activeMedications.filter((m) => memberIds.includes(m.id));
            if (members.length === 0) return null;
            return (
              <GroupCard
                key={group.id}
                group={group}
                members={members}
                memberOverrides={groupMembers.filter((m) => m.group_id === group.id)}
                allActiveMedications={activeMedications}
              />
            );
          })}

          {ungroupedMedications.map((med) => (
            <MedicationCard key={med.id} medication={med} />
          ))}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowInactive((s) => !s)}
          className="text-sm font-medium text-brand-text-muted hover:text-brand-text"
        >
          {showInactive ? "Hide" : "Show"} inactive medications (
          {inactiveQuery.data?.length ?? 0})
        </button>
        {showInactive && (
          <div className="mt-3 flex flex-col gap-2">
            {(inactiveQuery.data ?? []).map((med) => (
              <MedicationCard key={med.id} medication={med} />
            ))}
          </div>
        )}
      </div>

      <GroupModal
        open={creatingGroup}
        onOpenChange={setCreatingGroup}
        availableMedications={activeMedications}
      />
    </div>
  );
}
