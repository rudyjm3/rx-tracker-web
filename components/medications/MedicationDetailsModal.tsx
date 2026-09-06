"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { getDrugLabel, getMedia } from "@/lib/dailymed";
import type { Medication } from "@/lib/types/medications";

type DrugLabelResult = Record<string, unknown>;

const detailSections = [
  { title: "What it’s used for", fields: ["indications_and_usage"] },
  { title: "How to take this medication", fields: ["dosage_and_administration"] },
  { title: "Warnings", fields: ["boxed_warning", "warnings", "warnings_and_cautions"] },
  { title: "Side effects", fields: ["adverse_reactions"] },
  { title: "Ingredients", fields: ["active_ingredient", "inactive_ingredient"] },
  { title: "Product info", fields: ["dosage_forms_and_strengths", "how_supplied", "description"] },
];

function firstResult(data: unknown): DrugLabelResult | null {
  if (!data || typeof data !== "object" || !("results" in data)) return null;
  const results = (data as { results?: unknown[] }).results;
  const result = results?.[0];
  return result && typeof result === "object" ? (result as DrugLabelResult) : null;
}

function labelText(result: DrugLabelResult | null, fields: string[]): string {
  if (!result) return "";
  return fields
    .flatMap((field) => {
      const value = result[field];
      if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
      return typeof value === "string" ? [value] : [];
    })
    .join("\n\n")
    .trim();
}

function firstString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!Array.isArray(value)) return null;
  const item = value.find((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  return item?.trim() ?? null;
}

function labelSetId(result: DrugLabelResult | null): string | null {
  const directSetId = firstString(result?.set_id);
  if (directSetId) return directSetId;

  const openfda = result?.openfda;
  if (!openfda || typeof openfda !== "object") return null;
  return firstString((openfda as { spl_set_id?: unknown }).spl_set_id);
}

function productLabelImageUrl(mediaData: unknown): string | null {
  const media =
    mediaData && typeof mediaData === "object" && "data" in mediaData
      ? (mediaData as { data?: { media?: unknown[] } }).data?.media
      : null;
  if (!media) return null;

  const image =
    media.find(
      (item): item is { mime_type?: string; name?: string; url?: string } =>
        !!item &&
        typeof item === "object" &&
        typeof (item as { mime_type?: unknown }).mime_type === "string" &&
        (item as { mime_type: string }).mime_type.startsWith("image/") &&
        !/figure|structure|diagram/i.test(String((item as { name?: unknown }).name ?? "")),
    ) ??
    media.find(
      (item): item is { mime_type?: string; url?: string } =>
        !!item &&
        typeof item === "object" &&
        typeof (item as { mime_type?: unknown }).mime_type === "string" &&
        (item as { mime_type: string }).mime_type.startsWith("image/"),
    );

  const url = image && typeof image.url === "string" ? image.url : null;
  if (!url) return null;
  return url.startsWith("http") ? url : `https://dailymed.nlm.nih.gov${url}`;
}

interface MedicationDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication;
}

export function MedicationDetailsModal({
  open,
  onOpenChange,
  medication,
}: MedicationDetailsModalProps) {
  const labelQuery = useQuery({
    queryKey: ["drug-label", medication.name],
    queryFn: () => getDrugLabel(medication.name),
    enabled: open,
  });
  const result = firstResult(labelQuery.data);
  const setId = labelSetId(result);
  const mediaQuery = useQuery({
    queryKey: ["drug-media", setId],
    queryFn: () => getMedia(setId ?? ""),
    enabled: open && !!setId,
  });
  const productImageUrl = productLabelImageUrl(mediaQuery.data);
  const sections = detailSections
    .map((section) => ({ ...section, text: labelText(result, section.fields) }))
    .filter((section) => section.text.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="wide">
        <DialogHeader>
          <DialogTitle>{medication.name}</DialogTitle>
        </DialogHeader>

        {productImageUrl && (
          <div className="flex justify-center rounded-control border border-brand-border bg-brand-bg/50 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- DailyMed returns dynamic remote image URLs. */}
            <img
              src={productImageUrl}
              alt={`${medication.name} product label`}
              className="max-h-36 max-w-full rounded-control object-contain"
            />
          </div>
        )}

        {labelQuery.isLoading ? (
          <p className="text-sm text-brand-text-muted">Loading details…</p>
        ) : sections.length === 0 ? (
          <p className="text-sm text-brand-text-muted">
            Detailed information is not available for this medication.
          </p>
        ) : (
          <div className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto pr-1">
            {sections.map((section) => (
              <details
                key={section.title}
                className="rounded-control border border-brand-border bg-brand-bg/50 p-3"
              >
                <summary className="cursor-pointer text-sm font-semibold text-brand-navy">
                  {section.title}
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-brand-text-muted">
                  {section.text}
                </p>
              </details>
            ))}
            <p className="text-xs text-brand-text-muted">
              This information is for general reference only. Always follow your doctor’s or
              pharmacist’s instructions.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
