import { TopNav } from "@/components/layout/TopNav";
import { WizardShell } from "@/components/medications/wizard/WizardShell";

export default async function EditMedicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-brand-navy">
          Edit medication
        </h1>
        <WizardShell mode="edit" medicationId={id} />
      </main>
    </>
  );
}
