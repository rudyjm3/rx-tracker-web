"use client";

import { useState, type ChangeEvent } from "react";
import { Avatar } from "@/components/ui/Avatar";

interface AvatarPickerProps {
  currentUrl: string | null;
  label: string;
  color?: string | null;
  onChange: (file: File | null, removeExisting: boolean) => void;
}

/**
 * File select + live preview + "remove current photo" — shared by My
 * Profile and Manage Family's edit forms. Only reports the selection up
 * to the parent; the actual upload/delete happens on save (see
 * lib/user-profile.ts's uploadAvatar/deleteAvatarIfManaged), so canceling
 * the dialog never touches storage.
 */
export function AvatarPicker({ currentUrl, label, color, onChange }: AvatarPickerProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
  const [removeExisting, setRemoveExisting] = useState(false);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setRemoveExisting(false);
    onChange(file, false);
  }

  function handleRemoveToggle(checked: boolean) {
    setRemoveExisting(checked);
    setPreviewUrl(checked ? null : currentUrl);
    onChange(null, checked);
  }

  return (
    <div className="flex items-center gap-3">
      <span className="block h-12 w-12 shrink-0 overflow-hidden rounded-full">
        <Avatar pictureUrl={previewUrl} label={label} color={color} />
      </span>
      <div className="flex flex-col gap-1">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFile}
          className="text-xs text-brand-text"
        />
        {currentUrl && (
          <label className="flex items-center gap-1.5 text-xs font-normal text-brand-text-muted">
            <input
              type="checkbox"
              checked={removeExisting}
              onChange={(e) => handleRemoveToggle(e.target.checked)}
            />
            Remove current photo
          </label>
        )}
      </div>
    </div>
  );
}
