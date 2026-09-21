"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Medication, MedicationRefill } from "@/lib/types/medications";
import type { GroupDoseOverride } from "@/lib/utils";
import { MedicationCard } from "./MedicationCard";

interface SortableMedicationCardProps {
  medication: Medication;
  groupDoseOverrides?: GroupDoseOverride[];
  latestRefill?: MedicationRefill | null;
}

export function SortableMedicationCard({
  medication,
  groupDoseOverrides,
  latestRefill,
}: SortableMedicationCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: medication.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <MedicationCard
        medication={medication}
        groupDoseOverrides={groupDoseOverrides}
        latestRefill={latestRefill}
        isDragging={isDragging}
        dragHandle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="-ml-2 flex shrink-0 cursor-grab touch-none items-center px-1 text-brand-text-muted hover:text-brand-deep-blue active:cursor-grabbing"
            aria-label={`Drag to reorder ${medication.name}`}
          >
            <GripVertical size={18} aria-hidden="true" />
          </button>
        }
      />
    </div>
  );
}
