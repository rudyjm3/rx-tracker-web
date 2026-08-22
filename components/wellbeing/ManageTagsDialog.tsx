"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { inputClass } from "@/components/ui/Field";
import {
  deleteMoodTag,
  getMoodTags,
  renameMoodTag,
  setMoodTagAlwaysShow,
} from "@/lib/pain-mood";

interface ManageTagsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ManageTagsDialog({ open, onClose }: ManageTagsDialogProps) {
  const queryClient = useQueryClient();
  const tagsQuery = useQuery({ queryKey: ["mood-tags"], queryFn: getMoodTags, enabled: open });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["mood-tags"] });
  }

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameMoodTag(id, name),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't rename tag"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMoodTag(id),
    onSuccess: invalidate,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't delete tag"),
  });
  const alwaysShowMutation = useMutation({
    mutationFn: ({ id, alwaysShow }: { id: string; alwaysShow: boolean }) =>
      setMoodTagAlwaysShow(id, alwaysShow),
    onSuccess: invalidate,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't update tag"),
  });

  const tags = tagsQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {tags.length === 0 && (
            <p className="text-sm text-brand-text-muted">No tags yet.</p>
          )}
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-2 rounded-control border border-brand-border p-2"
            >
              {editingId === tag.id ? (
                <input
                  className={`${inputClass} flex-1`}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={30}
                  autoFocus
                />
              ) : (
                <span className="flex-1 text-sm text-brand-text">{tag.name}</span>
              )}

              <label className="flex items-center gap-1 text-xs text-brand-text-muted">
                <input
                  type="checkbox"
                  checked={tag.always_show}
                  onChange={(e) =>
                    alwaysShowMutation.mutate({ id: tag.id, alwaysShow: e.target.checked })
                  }
                />
                Always show
              </label>

              {editingId === tag.id ? (
                <Button
                  type="button"
                  size="compact"
                  onClick={() => renameMutation.mutate({ id: tag.id, name: editName })}
                >
                  Save
                </Button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(tag.id);
                    setEditName(tag.name);
                  }}
                  aria-label={`Rename ${tag.name}`}
                  className="text-brand-text-muted hover:text-brand-text"
                >
                  <Pencil size={14} />
                </button>
              )}

              <button
                type="button"
                onClick={() => deleteMutation.mutate(tag.id)}
                aria-label={`Delete ${tag.name}`}
                className="text-status-danger hover:opacity-80"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
