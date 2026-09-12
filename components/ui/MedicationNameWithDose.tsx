import {
  formatMedicationNameDose,
  formatPrescribedDose,
  type MedicationLabelInput,
} from "@/lib/medication-label";

interface MedicationNameWithDoseProps {
  medication: MedicationLabelInput;
  className?: string;
  nameClassName?: string;
  doseClassName?: string;
}

const DEFAULT_DOSE_CLASS_NAME = "text-[0.875em] font-bold text-[#6b7280]";

export function MedicationNameWithDose({
  medication,
  className,
  nameClassName,
  doseClassName,
}: MedicationNameWithDoseProps) {
  const dose = formatPrescribedDose(medication);
  if (!dose) {
    return <span className={nameClassName ?? className}>{medication.name}</span>;
  }

  return (
    <span className={className} title={formatMedicationNameDose(medication)}>
      <span className={nameClassName}>{medication.name}</span>{" "}
      <span className={doseClassName ?? DEFAULT_DOSE_CLASS_NAME}>{dose}</span>
    </span>
  );
}
