"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { inputClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { addNote, deleteNote, getNotes } from "@/lib/notes";
import type { Medication } from "@/lib/types/medications";

interface NotesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication;
}

export function NotesModal({ open, onOpenChange, medication }: NotesModalProps) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const { data: notes } = useQuery({
    queryKey: ["notes", medication.id],
    queryFn: () => getNotes(medication.id),
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: () => addNote(medication.id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", medication.id] });
      setNote("");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", medication.id] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    addMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notes — {medication.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
          <input
            type="text"
            placeholder="Add a note…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass + " flex-1"}
          />
          <Button type="submit" size="compact" disabled={addMutation.isPending}>
            Add
          </Button>
        </form>

        <div className="flex max-h-56 flex-col gap-2 overflow-auto">
          {notes?.length === 0 && (
            <p className="text-sm text-brand-text-muted">No notes yet.</p>
          )}
          {notes?.map((n) => (
            <div
              key={n.id}
              className="flex items-start justify-between gap-2 rounded-control border border-brand-border p-2"
            >
              <div>
                <p className="text-sm text-brand-text">{n.note}</p>
                <p className="text-xs text-brand-text-muted">
                  {new Date(n.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(n.id)}
                className="text-brand-text-muted hover:text-status-danger"
                aria-label="Delete"
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
