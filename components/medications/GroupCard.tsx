"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { to12h } from "@/lib/utils";
import { deleteGroup } from "@/lib/medications";
import type { Medication, MedicationGroup } from "@/lib/types/medications";
import { MedicationCard } from "./MedicationCard";
import { GroupModal } from "./GroupModal";

interface GroupCardProps {
  group: MedicationGroup;
  members: Medication[];
  memberOverrides: { medication_id: string; quantity_per_dose: number | null }[];
  allActiveMedications: Medication[];
}

export function GroupCard({
  group,
  members,
  memberOverrides,
  allActiveMedications,
}: GroupCardProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => deleteGroup(group.id),
    onSuccess: () => {
      toast.success(`${group.name} deleted`);
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group-members"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    },
  });

  return (
    <div className="rounded-hero border border-brand-border bg-brand-bg p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-brand-navy">{group.name}</h2>
          <p className="text-sm text-brand-text-muted">{to12h(group.scheduled_time.slice(0, 5))}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-brand-text-muted hover:text-brand-deep-blue"
            aria-label="Edit group"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={() => deleteMutation.mutate()}
            className="text-brand-text-muted hover:text-status-danger"
            aria-label="Delete group"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {members.length === 0 ? (
          <p className="text-sm text-brand-text-muted">
            No medications in this group yet.
          </p>
        ) : (
          members.map((med) => <MedicationCard key={med.id} medication={med} />)
        )}
      </div>

      <GroupModal
        open={editing}
        onOpenChange={setEditing}
        group={group}
        existingMembers={memberOverrides}
        availableMedications={allActiveMedications}
      />
    </div>
  );
}
