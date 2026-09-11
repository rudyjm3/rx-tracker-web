"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { createSideEffectTag, getSideEffectTags } from "@/lib/side-effect-tags";
import { ManageSideEffectTagsDialog } from "./ManageSideEffectTagsDialog";

interface SideEffectTagPickerProps {
  selected: string[];
  onChange: (effects: string[]) => void;
}

export function SideEffectTagPicker({ selected, onChange }: SideEffectTagPickerProps) {
  const queryClient = useQueryClient();
  const tagsQuery = useQuery({ queryKey: ["side-effect-tags"], queryFn: getSideEffectTags });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const createMutation = useMutation({
    mutationFn: (name: string) => createSideEffectTag(name, true),
    onSuccess: (tag) => {
      queryClient.invalidateQueries({ queryKey: ["side-effect-tags"] });
      onChange([...selected, tag.name]);
      setNewTagName("");
      setShowAdd(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't add side effect"),
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
  // is off — so picking one doesn't make it disappear from this same
  // form before it's saved.
  const visibleTags = [
    ...tags.filter((t) => t.always_show),
    ...tags.filter((t) => !t.always_show && selected.includes(t.name)),
  ];

  return (
    <div className="flex flex-col gap-2" ref={containerRef}>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((name) => (
            <span
              key={name}
              className="flex items-center gap-1 rounded-full border border-transparent bg-gradient-brand px-3 py-1 text-xs font-medium text-white"
            >
              {name}
              <button
                type="button"
                onClick={() => toggleTag(name)}
                aria-label={`Remove ${name}`}
                className="hover:opacity-80"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen((o) => !o)}
          className={`${inputClass} flex w-full items-center justify-between text-left`}
        >
          <span className="text-brand-text-muted">Select side effects…</span>
          <ChevronDown size={16} className="text-brand-text-muted" />
        </button>

        {dropdownOpen && (
          <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-control border border-brand-border bg-white shadow-md">
            {visibleTags.length === 0 && (
              <p className="px-3 py-2 text-sm text-brand-text-muted">No side effects yet.</p>
            )}
            {visibleTags.map((tag) => (
              <label
                key={tag.id}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-brand-text hover:bg-brand-bg"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(tag.name)}
                  onChange={() => toggleTag(tag.name)}
                />
                {tag.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="flex gap-2">
          <input
            className={`${inputClass} flex-1`}
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            maxLength={30}
            placeholder="Side effect name"
          />
          <Button type="button" size="compact" onClick={handleAddSubmit}>
            Add
          </Button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowAdd((s) => !s)}
          className="text-xs text-brand-deep-blue hover:underline"
        >
          + Side effect
        </button>
        <button
          type="button"
          onClick={() => setManageOpen(true)}
          className="text-xs text-brand-deep-blue hover:underline"
        >
          Manage side effects
        </button>
      </div>

      <ManageSideEffectTagsDialog open={manageOpen} onClose={() => setManageOpen(false)} />
    </div>
  );
}
