"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { createMoodTag, getMoodTags } from "@/lib/pain-mood";
import { ManageTagsDialog } from "./ManageTagsDialog";

interface MoodTagPickerProps {
  selected: string[];
  onChange: (tags: string[]) => void;
}

export function MoodTagPicker({ selected, onChange }: MoodTagPickerProps) {
  const queryClient = useQueryClient();
  const tagsQuery = useQuery({ queryKey: ["mood-tags"], queryFn: getMoodTags });
  const [showAdd, setShowAdd] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [manageOpen, setManageOpen] = useState(false);

  const createMutation = useMutation({
    mutationFn: (name: string) => createMoodTag(name, true),
    onSuccess: (tag) => {
      queryClient.invalidateQueries({ queryKey: ["mood-tags"] });
      onChange([...selected, tag.name]);
      setNewTagName("");
      setShowAdd(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't add tag"),
  });

  function toggleTag(name: string) {
    onChange(
      selected.includes(name) ? selected.filter((t) => t !== name) : [...selected, name],
    );
  }

  function handleAddSubmit() {
    const trimmed = newTagName.trim();
    if (trimmed) createMutation.mutate(trimmed);
  }

  const tags = tagsQuery.data ?? [];
  // Always-show tags first, plus any selected tag whose always_show flag
  // is off — so picking a tag once doesn't make it disappear from this
  // same form before it's saved.
  const visibleTags = [
    ...tags.filter((t) => t.always_show),
    ...tags.filter((t) => !t.always_show && selected.includes(t.name)),
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {visibleTags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggleTag(tag.name)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              selected.includes(tag.name)
                ? "border-transparent bg-gradient-brand text-white"
                : "border-brand-border bg-white text-brand-text hover:bg-brand-bg",
            )}
          >
            {tag.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowAdd((s) => !s)}
          className="rounded-full border border-dashed border-brand-border px-3 py-1 text-xs font-medium text-brand-text-muted hover:bg-brand-bg"
        >
          + Tags
        </button>
      </div>

      {showAdd && (
        <div className="flex gap-2">
          <input
            className={`${inputClass} flex-1`}
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            maxLength={30}
            placeholder="Tag name"
          />
          <Button type="button" size="compact" onClick={handleAddSubmit}>
            Add
          </Button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setManageOpen(true)}
        className="self-start text-xs text-brand-deep-blue hover:underline"
      >
        Manage tags
      </button>

      <ManageTagsDialog open={manageOpen} onClose={() => setManageOpen(false)} />
    </div>
  );
}
