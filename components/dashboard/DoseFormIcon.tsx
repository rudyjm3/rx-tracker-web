import { Droplet, FlaskConical, Pill, Syringe, Wind } from "lucide-react";

// Stand-in for the brand's illustrated dose-form graphics (med-pill.png,
// med-capsule.png, etc. from the original app's asset set), which aren't
// available in this repo. Swap for the real illustrations once copied in.
export function DoseFormIcon({
  doseForm,
  size = 44,
}: {
  doseForm: string | null | undefined;
  size?: number;
}) {
  const iconProps = { size: size * 0.55, className: "text-brand-deep-blue" };
  let Icon = Pill;
  switch (doseForm) {
    case "liquid":
      Icon = FlaskConical;
      break;
    case "inhaler":
      Icon = Wind;
      break;
    case "injection":
      Icon = Syringe;
      break;
    case "drops":
      Icon = Droplet;
      break;
    case "patch":
    case "capsule":
    case "tablet":
    default:
      Icon = Pill;
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-white shadow-card"
      style={{ width: size, height: size }}
    >
      <Icon {...iconProps} />
    </div>
  );
}
