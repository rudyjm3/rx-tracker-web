import { canonicalDoseUnit, parseStrength, strengthsEqual } from "@/lib/utils";

// Pure helpers for openFDA's NDC directory (https://api.fda.gov/drug/ndc.json),
// shared by the dailymed-proxy route (server) and its callers. The NDC
// directory is the structured source for "every strength this drug comes in"
// and for the SPL document (openfda.spl_set_id) each product listing belongs
// to; the drug-label endpoint's brand/generic name fields carry neither.
//
// Response shape (verified against the live endpoint):
//   results[]: { product_ndc, generic_name, brand_name, dosage_form,
//     active_ingredients?: [{ name, strength: ".25 mg/1" | "1 mg/mL" | ... }],
//     openfda?: { spl_set_id?: string[] } }
// active_ingredients and openfda.spl_set_id are each missing on some
// listings; zero matches come back as HTTP 404 { error: { code: NOT_FOUND } }.

export const OPENFDA_NDC_BASE = "https://api.fda.gov/drug/ndc.json";

export interface NdcProduct {
  name: string;
  doseAmount: number | null;
  doseUnit: string | null;
  // Display form of the strength, e.g. "2mg", "1mg/mL", "20/12.5mg".
  strengthLabel: string;
  setId: string | null;
}

export interface NdcSuggestion extends NdcProduct {
  label: string;
}

const LOWERCASE_WORDS = new Set(["and", "of", "in", "with", "for", "to", "the"]);

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s(/-])([a-z]+)/g, (_, sep: string, word: string, offset: number) =>
      offset > 0 && LOWERCASE_WORDS.has(word) ? sep + word : sep + word[0].toUpperCase() + word.slice(1),
    );
}

function cleanNumber(raw: string): string {
  const n = Number(raw);
  return Number.isFinite(n) ? String(n) : raw;
}

function strengthLabelFor(strengths: string[]): string {
  if (strengths.length === 0) return "";
  const parsed = strengths.map(parseStrength);
  if (parsed.every((p) => p)) {
    const units = new Set(parsed.map((p) => p!.unit));
    if (units.size === 1) {
      return `${parsed.map((p) => p!.amount).join("/")}${[...units][0]}`;
    }
  }
  return strengths
    .map((s) => s.replace(/(\d*\.?\d+)/g, (m) => cleanNumber(m)).replace(/\s+/g, ""))
    .join(" / ");
}

export function normalizeNdcProducts(data: unknown): NdcProduct[] {
  const results =
    data && typeof data === "object" && Array.isArray((data as { results?: unknown }).results)
      ? ((data as { results: unknown[] }).results as Record<string, unknown>[])
      : [];

  const products: NdcProduct[] = [];
  for (const result of results) {
    if (!result || typeof result !== "object") continue;
    const brand = typeof result.brand_name === "string" ? result.brand_name.trim() : "";
    const generic = typeof result.generic_name === "string" ? result.generic_name.trim() : "";
    if (!brand && !generic) continue;
    // A generic's brand_name is just its generic name (in varying case);
    // title-case those, keep real brand names (RISPERDAL) as listed.
    const name =
      !brand || brand.toLowerCase() === generic.toLowerCase() ? titleCase(generic || brand) : brand;

    const strengths = Array.isArray(result.active_ingredients)
      ? (result.active_ingredients as { strength?: unknown }[])
          .map((ingredient) => (typeof ingredient?.strength === "string" ? ingredient.strength : ""))
          .filter(Boolean)
      : [];
    // Only a single-ingredient, per-dosage-unit strength is a usable dose.
    const parsed = strengths.length === 1 ? parseStrength(strengths[0]) : null;

    const openfda = result.openfda as { spl_set_id?: unknown } | undefined;
    const setIds = Array.isArray(openfda?.spl_set_id) ? openfda.spl_set_id : [];
    const setId = setIds.find((id): id is string => typeof id === "string" && id.length > 0) ?? null;

    products.push({
      name,
      doseAmount: parsed?.amount ?? null,
      doseUnit: parsed?.unit ?? null,
      strengthLabel: strengthLabelFor(strengths),
      setId,
    });
  }
  return products;
}

const MAX_SUGGESTIONS = 30;

// One suggestion per distinct name + strength (the directory lists the same
// product once per labeler/package), carrying the first SPL set id seen.
export function toSuggestions(products: NdcProduct[], strengthFilter?: number | null): NdcSuggestion[] {
  const byKey = new Map<string, NdcSuggestion>();
  for (const product of products) {
    if (
      strengthFilter != null &&
      !(product.doseAmount != null && String(product.doseAmount).startsWith(String(strengthFilter)))
    ) {
      continue;
    }
    const key = `${product.name.toLowerCase()}|${product.strengthLabel}`;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.setId && product.setId) existing.setId = product.setId;
      continue;
    }
    byKey.set(key, {
      ...product,
      label: product.strengthLabel ? `${product.name} ${product.strengthLabel}` : product.name,
    });
  }
  return [...byKey.values()]
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
        (a.doseAmount ?? Infinity) - (b.doseAmount ?? Infinity) ||
        a.strengthLabel.localeCompare(b.strengthLabel),
    )
    .slice(0, MAX_SUGGESTIONS);
}

// "risperidone 3", "rispe 0.5mg", "lisinopril hydro" → name words plus an
// optional leading strength number the user has started typing.
export function parseSearchTerm(term: string): { words: string[]; strength: number | null } {
  let text = term.toLowerCase().replace(/[^a-z0-9.\s]/g, " ").trim();
  let strength: number | null = null;
  const tail = text.match(/\s(\d+(?:\.\d+)?|\.\d+)\s*(?:mg|mcg|ug|g|ml|iu|units?)?$/);
  if (tail && text.slice(0, tail.index).trim()) {
    strength = Number(tail[1]);
    text = text.slice(0, tail.index).trim();
  }
  const words = text.split(/\s+/).map((w) => w.replace(/\./g, "")).filter(Boolean);
  return { words, strength };
}

export function ndcSearchUrl(words: string[]): string {
  const expr = words.map((w, i) => (i === words.length - 1 ? `${w}*` : w)).join(" AND ");
  const search = `(brand_name:(${expr}) OR generic_name:(${expr})) AND finished:true`;
  return `${OPENFDA_NDC_BASE}?search=${encodeURIComponent(search)}&limit=100`;
}

function quote(value: string): string {
  return `"${value.replace(/["\\]/g, " ").trim()}"`;
}

// Looks a product up by exact (phrase) name; when the dose is a plain
// mass/volume strength, narrow to listings carrying that exact strength so
// the page of results isn't dominated by other strengths.
export function ndcStrengthUrl(drugName: string, doseAmount?: number | null, doseUnit?: string | null): string {
  const nameExpr = quote(drugName);
  let search = `(brand_name:${nameExpr} OR generic_name:${nameExpr}) AND finished:true`;
  const unit = canonicalDoseUnit(doseUnit);
  if (doseAmount && unit && ["mg", "mcg", "g", "mL"].includes(unit)) {
    // The directory writes sub-1 strengths without the leading zero (".5 mg/1").
    const amount = String(doseAmount).replace(/^0\./, ".");
    search += ` AND active_ingredients.strength:${quote(`${amount} ${unit}/1`)}`;
  }
  return `${OPENFDA_NDC_BASE}?search=${encodeURIComponent(search)}&limit=100`;
}

export interface SetIdMatch {
  setId: string;
  // False when no listing had the requested strength and the first listing
  // with an SPL set id was used instead.
  exact: boolean;
}

export function pickSetIdForStrength(
  products: NdcProduct[],
  doseAmount: number | null | undefined,
  doseUnit: string | null | undefined,
): SetIdMatch | null {
  const withSetId = products.filter((p) => p.setId);
  if (withSetId.length === 0) return null;

  const unit = canonicalDoseUnit(doseUnit);
  if (doseAmount && unit) {
    const exact = withSetId.find(
      (p) =>
        p.doseAmount != null &&
        p.doseUnit != null &&
        strengthsEqual({ amount: p.doseAmount, unit: p.doseUnit }, { amount: doseAmount, unit }),
    );
    if (exact) return { setId: exact.setId!, exact: true };
  }
  return { setId: withSetId[0].setId!, exact: false };
}
