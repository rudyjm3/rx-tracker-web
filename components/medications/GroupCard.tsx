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
    <div className="rounded-hero border border-brand-border bg-gradient-brand p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-[#f9f9f9]">{group.name}</h2>
          <p className="text-sm font-semibold text-[#333]">{to12h(group.scheduled_time.slice(0, 5))}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[#d4d4d4] hover:text-brand-deep-blue"
            aria-label="Edit group"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={() => deleteMutation.mutate()}
            className="text-[#d4d4d4] hover:text-status-danger"
            aria-label="Delete group"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {members.length === 0 ? (
          <p className="text-sm text-[#f9f9f9]">
            No medications in this group yet.
          </p>
        ) : (
          members.map((med) => (
            <MedicationCard
              key={med.id}
              medication={med}
              groupDoseOverrides={memberOverrides
                .filter((override) => override.medication_id === med.id)
                .map((override) => ({
                  scheduled_time: group.scheduled_time,
                  quantity_per_dose: override.quantity_per_dose,
                }))}
            />
          ))
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
