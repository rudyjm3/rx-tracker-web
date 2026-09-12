export interface MedicationLabelInput {
  name: string;
  dose?: string | null;
  dose_amount?: number | null;
  dose_unit?: string | null;
}

export function formatPrescribedDose(medication: MedicationLabelInput): string {
  if (medication.dose_amount != null) {
    return `${medication.dose_amount}${medication.dose_unit ?? ""}`.trim();
  }
  return medication.dose?.trim() ?? "";
}

export function formatMedicationNameDose(medication: MedicationLabelInput): string {
  const dose = formatPrescribedDose(medication);
  return dose ? `${medication.name} ${dose}` : medication.name;
}
