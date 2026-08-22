"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Field, inputClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { createGroup, updateGroup, type GroupMemberInput } from "@/lib/medications";
import type { Medication, MedicationGroup } from "@/lib/types/medications";

interface GroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: MedicationGroup;
  existingMembers?: { medication_id: string; quantity_per_dose: number | null }[];
  availableMedications: Medication[];
}

export function GroupModal({
  open,
  onOpenChange,
  group,
  existingMembers,
  availableMedications,
}: GroupModalProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(group);

  const [name, setName] = useState(group?.name ?? "");
  const [scheduledTime, setScheduledTime] = useState(group?.scheduled_time.slice(0, 5) ?? "08:00");
  const [selected, setSelected] = useState<Record<string, string>>({});

  // Re-seed the form fields whenever the dialog transitions to open —
  // done during render (React's documented pattern for "adjust state
  // when a prop changes") rather than in a useEffect, since GroupModal
  // itself never unmounts between opens (only Radix's Dialog content
  // portal does), so local state would otherwise carry over stale
  // values from the previous time it was opened.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(group?.name ?? "");
      setScheduledTime(group?.scheduled_time.slice(0, 5) ?? "08:00");
      const initial: Record<string, string> = {};
      for (const m of existingMembers ?? []) {
        initial[m.medication_id] =
          m.quantity_per_dose != null ? String(m.quantity_per_dose) : "";
      }
      setSelected(initial);
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const members: GroupMemberInput[] = Object.entries(selected).map(
        ([medication_id, qty], i) => ({
          medication_id,
          quantity_per_dose: qty ? Number(qty) : null,
          sort_order: i,
        }),
      );
      if (isEdit && group) {
        await updateGroup(group.id, { name, scheduled_time: scheduledTime }, members);
      } else {
        await createGroup({ name, scheduled_time: scheduledTime }, members);
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Group updated" : "Group created");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group-members"] });
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    },
  });

  function toggleMedication(id: string) {
    setSelected((prev) => {
      const next = { ...prev };
      if (id in next) {
        delete next[id];
      } else {
        next[id] = "";
      }
      return next;
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit group" : "New group"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Group name">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Scheduled time">
            <input
              type="time"
              required
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className={inputClass}
            />
          </Field>

          <div className="flex flex-col gap-2">
            <span className="text-sm text-brand-text">Members</span>
            <div className="flex max-h-48 flex-col gap-2 overflow-auto">
              {availableMedications.map((med) => (
                <div key={med.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={med.id in selected}
                    onChange={() => toggleMedication(med.id)}
                  />
                  <span className="flex-1 text-sm text-brand-text">{med.name}</span>
                  {med.id in selected && (
                    <input
                      type="number"
                      step="any"
                      placeholder="Qty override"
                      value={selected[med.id]}
                      onChange={(e) =>
                        setSelected((prev) => ({ ...prev, [med.id]: e.target.value }))
                      }
                      className={inputClass + " w-32"}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Create group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
