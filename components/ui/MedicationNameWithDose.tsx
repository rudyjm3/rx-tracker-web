import { formatMedicationNameDose, type MedicationLabelInput } from "@/lib/medication-label";

interface MedicationNameWithDoseProps {
  medication: MedicationLabelInput;
  className?: string;
  nameClassName?: string;
  doseClassName?: string;
}

export function MedicationNameWithDose({
  medication,
  className,
  nameClassName,
  doseClassName,
}: MedicationNameWithDoseProps) {
  const dose = medication.dose?.trim();
  if (!dose) {
    return <span className={nameClassName ?? className}>{medication.name}</span>;
  }

  return (
    <span className={className} title={formatMedicationNameDose(medication)}>
      <span className={nameClassName}>{medication.name}</span>{" "}
      <span className={doseClassName ?? "text-brand-text-muted"}>{dose}</span>
    </span>
  );
}
