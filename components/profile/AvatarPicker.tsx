"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Camera, Trash2, Upload } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

interface AvatarPickerProps {
  currentUrl: string | null;
  label: string;
  color?: string | null;
  onChange: (file: File | null, removeExisting: boolean) => void;
}

/**
 * File select + live preview + remove — shared by My Profile and Manage
 * Family's edit forms. Only reports the selection up to the parent; the
 * actual upload/delete happens on save (see lib/user-profile.ts's
 * uploadAvatar/deleteAvatarIfManaged), so canceling the dialog never
 * touches storage.
 */
export function AvatarPicker({ currentUrl, label, color, onChange }: AvatarPickerProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
  const [hasPhoto, setHasPhoto] = useState(!!currentUrl);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setHasPhoto(true);
    onChange(file, false);
  }

  function handleRemove() {
    setPreviewUrl(null);
    setHasPhoto(false);
    onChange(null, true);
  }

  return (
    <div className="flex items-center gap-4">
      <span className="block h-16 w-16 shrink-0 overflow-hidden rounded-full">
        <Avatar pictureUrl={hasPhoto ? previewUrl : null} label={label} color={color} />
      </span>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-brand-text-muted">Profile photo</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-control border border-brand-border px-3 py-1.5 text-xs font-medium text-brand-text hover:bg-brand-bg"
          >
            <Upload size={14} />
            Upload photo
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-control border border-brand-border px-3 py-1.5 text-xs font-medium text-brand-text hover:bg-brand-bg"
          >
            <Camera size={14} />
            Take a photo
          </button>
          {hasPhoto && (
            <button
              type="button"
              onClick={handleRemove}
              className="flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-medium text-status-danger hover:bg-brand-bg"
            >
              <Trash2 size={14} />
              Remove
            </button>
          )}
        </div>
      </div>
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFile}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        capture="user"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
