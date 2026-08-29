"use client";

import { useState } from "react";
import Link from "next/link";
import { Layers } from "lucide-react";
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
import { to12h } from "@/lib/utils";
import { MedicationCard } from "./MedicationCard";
import { GroupCard } from "./GroupCard";
import { GroupModal } from "./GroupModal";

type Tab = "active" | "inactive" | "groups";

export function MedicationsListClient() {
  const queryClient = useQueryClient();
  const { activeProfileId, isResolving } = useActiveProfile();
  const [tab, setTab] = useState<Tab>("active");
  const [creatingGroup, setCreatingGroup] = useState(false);

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

  const activeMedications = activeQuery.data ?? [];
  const inactiveMedications = inactiveQuery.data ?? [];
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

  if (isResolving || activeQuery.isLoading) {
    return <p className="text-brand-text-muted">Loading medications…</p>;
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "active", label: "Active", count: activeMedications.length },
    { key: "inactive", label: "Inactive", count: inactiveMedications.length },
    { key: "groups", label: "Groups", count: groups.length },
  ];

  function membersOf(groupId: string) {
    const memberIds = groupMembers
      .filter((m) => m.group_id === groupId)
      .map((m) => m.medication_id);
    return activeMedications.filter((m) => memberIds.includes(m.id));
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
        <Link href="/medications/new" className={cn(buttonVariants())}>
          + Add medication
        </Link>
      </div>

      {tab === "active" &&
        (activeMedications.length === 0 ? (
          <p className="text-brand-text-muted">
            No medications yet. Add your first one to get started.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((group) => {
              const members = membersOf(group.id);
              if (members.length === 0) return null;
              return (
                <div key={group.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 px-1 text-sm font-semibold text-brand-text-muted">
                    <Layers size={14} />
                    {group.name} · {to12h(group.scheduled_time.slice(0, 5))}
                  </div>
                  {members.map((med) => (
                    <MedicationCard key={med.id} medication={med} />
                  ))}
                </div>
              );
            })}

            {ungroupedMedications.map((med) => (
              <MedicationCard key={med.id} medication={med} />
            ))}
          </div>
        ))}

      {tab === "inactive" &&
        (inactiveMedications.length === 0 ? (
          <p className="text-brand-text-muted">No inactive medications.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {inactiveMedications.map((med) => (
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
