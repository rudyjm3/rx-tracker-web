"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface ImageLightboxProps {
  imageUrl: string;
  caption?: string | null;
  open: boolean;
  onClose: () => void;
}

// Image Lightbox: full-screen overlay with image + caption + close
// button. A bare fixed-overlay div — like AlarmOverlay, not a wrapped
// Radix Dialog — since there's no form here, just an image to view
// larger. Shares AlarmOverlay's z-[100]/dark-backdrop convention so it
// sits above the app's Dialog-based modals (z-50).
export function ImageLightbox({ imageUrl, caption, open, onClose }: ImageLightboxProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={caption ? `${caption} — enlarged photo` : "Enlarged photo"}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-dark-navy/90 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 text-white/80 transition hover:text-white"
      >
        <X size={28} />
      </button>

      <div
        className="flex max-h-full max-w-2xl flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* User-uploaded Supabase Storage URL, not a static/known asset
            domain for next/image — same exemption as Avatar.tsx. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={caption ?? ""}
          className="max-h-[75vh] max-w-full rounded-hero object-contain shadow-card"
        />
        {caption && <p className="text-center text-sm font-medium text-white">{caption}</p>}
      </div>
    </div>
  );
}
