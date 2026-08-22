import { cn } from "@/lib/cn";

interface AvatarProps {
  pictureUrl?: string | null;
  label: string; // used to derive the fallback initial
  color?: string | null;
  className?: string;
}

// Renders a profile picture when set, else the label's first letter on a
// colored circle — port of the reference PHP app's render_avatar().
export function Avatar({ pictureUrl, label, color, className }: AvatarProps) {
  if (pictureUrl) {
    return (
      // User-uploaded Supabase Storage URLs, not a static/known asset
      // domain for next/image.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={pictureUrl}
        alt=""
        className={cn("h-full w-full rounded-full object-cover", className)}
      />
    );
  }

  const initial = label.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full text-sm font-semibold text-white",
        className,
      )}
      style={{ backgroundColor: color ?? "#6366f1" }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
