import Image from "next/image";

// Same illustrated dose-form graphics as the original app's asset set
// (assets/images/med-*.png), copied into public/images/dose-forms.
const DOSE_FORM_IMAGE_MAP: Record<string, string> = {
  tablet: "med-pill.png",
  capsule: "med-capsule.png",
  liquid: "med-bottle.png",
  inhaler: "med-inhaler.png",
  injection: "med-injection.png",
  patch: "med-patch.png",
  drops: "med-drop.png",
};

export function DoseFormIcon({
  doseForm,
  size = 84,
}: {
  doseForm: string | null | undefined;
  size?: number;
}) {
  const image = DOSE_FORM_IMAGE_MAP[doseForm ?? ""] ?? "med-pill.png";
  return (
    <div
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: "rgba(255, 255, 255, 0.12)",
        border: "3px solid rgba(255, 255, 255, 0.30)",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.22)",
      }}
    >
      <Image
        src={`/images/dose-forms/${image}`}
        alt=""
        fill
        className="object-cover"
        sizes={`${size}px`}
      />
    </div>
  );
}
