export interface MedicationLabelInput {
  name: string;
  dose?: string | null;
}

export function formatMedicationNameDose(medication: MedicationLabelInput): string {
  const dose = medication.dose?.trim();
  return dose ? `${medication.name} ${dose}` : medication.name;
}
