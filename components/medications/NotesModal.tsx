"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { inputClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { addNote, deleteNote, getNotes, updateNote } from "@/lib/notes";
import type { Medication } from "@/lib/types/medications";

interface NotesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication;
}

function formatNoteDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function NotesModal({ open, onOpenChange, medication }: NotesModalProps) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState("");
  const instructions = medication.instructions?.trim();

  const { data: notes } = useQuery({
    queryKey: ["notes", medication.id],
    queryFn: () => getNotes(medication.id),
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: () => addNote(medication.id, note.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", medication.id] });
      setNote("");
      setShowAddForm(false);
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
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => updateNote(id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", medication.id] });
      setEditingNoteId(null);
      setEditingNote("");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    addMutation.mutate();
  }

  function closeAddForm() {
    setNote("");
    setShowAddForm(false);
  }

  function startEditing(id: string, text: string) {
    setEditingNoteId(id);
    setEditingNote(text);
  }

  function cancelEditing() {
    setEditingNoteId(null);
    setEditingNote("");
  }

  function saveEdit(id: string) {
    const text = editingNote.trim();
    if (!text) return;
    updateMutation.mutate({ id, text });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="wide" className="max-w-3xl p-0">
        <DialogHeader className="-mx-6 -mt-6 mb-0 border-b border-brand-border px-6 pb-3 pt-6">
          <DialogTitle>
            {medication.name}{" "}
            <span className="text-sm font-bold text-brand-text-muted">{medication.dose}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto">
          {instructions && (
            <section>
              <p className="mb-1 text-sm text-brand-text-muted">
                Instructions (from medication record)
              </p>
              <p className="whitespace-pre-wrap text-base leading-7 text-brand-navy">
                {instructions}
              </p>
            </section>
          )}

          <div className="flex flex-col gap-3">
            {notes === undefined && (
              <p className="text-sm text-brand-text-muted">Loading…</p>
            )}

            {notes?.length === 0 && !instructions && (
              <p className="text-sm text-brand-text-muted">No notes yet. Add one below.</p>
            )}

            {notes?.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-3 rounded-control border border-brand-border bg-brand-bg p-4"
              >
                <div className="min-w-0 flex-1">
                  {editingNoteId === n.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        rows={4}
                        maxLength={5000}
                        value={editingNote}
                        onChange={(e) => setEditingNote(e.target.value)}
                        className={inputClass + " resize-y"}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="compact"
                          disabled={updateMutation.isPending}
                          onClick={() => saveEdit(n.id)}
                        >
                          {updateMutation.isPending ? "Saving…" : "Save"}
                        </Button>
                        <Button type="button" size="compact" variant="ghost" onClick={cancelEditing}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-base leading-6 text-brand-navy">{n.note}</p>
                  )}
                  <p className="mt-2 text-sm text-brand-text-muted">
                    Added {formatNoteDate(n.created_at)}
                    {n.updated_at && n.updated_at !== n.created_at
                      ? ` · Edited ${formatNoteDate(n.updated_at)}`
                      : ""}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-brand-text-muted hover:bg-brand-card hover:text-brand-navy"
                      aria-label="Note options"
                    >
                      <MoreVertical size={18} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => startEditing(n.id, n.note)}>
                      <Pencil size={14} />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-status-danger"
                      disabled={deleteMutation.isPending}
                      onSelect={() => deleteMutation.mutate(n.id)}
                    >
                      <Trash2 size={14} />
                      Delete note
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>

          {!showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="self-start text-base font-semibold text-brand-navy underline hover:text-brand-deep-blue"
            >
              + Add new note
            </button>
          )}

          {showAddForm && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <textarea
                rows={4}
                maxLength={5000}
                placeholder="Enter note…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={inputClass + " resize-y"}
              />
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={addMutation.isPending}>
                  {addMutation.isPending ? "Saving…" : "Save note"}
                </Button>
                <Button type="button" variant="ghost" onClick={closeAddForm}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
