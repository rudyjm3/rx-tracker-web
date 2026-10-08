export interface DailyMedSearchResult {
  setid: string;
  title: string;
  published_date?: string;
}

interface DailyMedSearchResponse {
  data?: { setid: string; title: string; published_date?: string }[];
}

export async function searchDrugName(
  name: string,
): Promise<DailyMedSearchResult[]> {
  const response = await fetch(
    `/api/dailymed-proxy?mode=search&drug_name=${encodeURIComponent(name)}`,
  );
  if (!response.ok) return [];

  const json: DailyMedSearchResponse = await response.json();
  return (json.data ?? []).map((item) => ({
    setid: item.setid,
    title: item.title,
    published_date: item.published_date,
  }));
}

export async function getMedia(setId: string): Promise<unknown | null> {
  const response = await fetch(
    `/api/dailymed-proxy?mode=media&sid=${encodeURIComponent(setId)}`,
  );
  if (!response.ok) return null;
  return response.json();
}

export async function getDrugLabel(name: string): Promise<unknown | null> {
  const response = await fetch(
    `/api/dailymed-proxy?mode=label&drug_name=${encodeURIComponent(name)}`,
  );
  if (!response.ok) return null;
  return response.json();
}

export interface DrugSuggestion {
  label: string;
  name: string;
  doseAmount: number | null;
  doseUnit: string | null;
  setId: string | null;
}

// Name + strength suggestions ("Risperidone 3mg") from openFDA's NDC
// directory — see lib/dailymed-ndc.ts for why that, not the label endpoint.
export async function searchDrugSuggestions(term: string): Promise<DrugSuggestion[]> {
  const response = await fetch(
    `/api/dailymed-proxy?mode=ndc_search&drug_name=${encodeURIComponent(term)}`,
  );
  if (!response.ok) return [];
  const json: { data?: DrugSuggestion[] } = await response.json();
  return json.data ?? [];
}

export interface SetIdMatch {
  setId: string;
  exact: boolean;
}

// Finds the SPL set id for a medication that has none saved, preferring a
// listing whose strength equals the medication's dose.
export async function findSetIdForStrength(
  name: string,
  doseAmount: number | null,
  doseUnit: string | null,
): Promise<SetIdMatch | null> {
  const params = new URLSearchParams({ mode: "ndc_match", drug_name: name });
  if (doseAmount != null) params.set("dose_amount", String(doseAmount));
  if (doseUnit) params.set("dose_unit", doseUnit);
  const response = await fetch(`/api/dailymed-proxy?${params}`);
  if (!response.ok) return null;
  const json: { data?: SetIdMatch | null } = await response.json();
  return json.data ?? null;
}

export async function getLabelBySetId(setId: string): Promise<unknown | null> {
  const response = await fetch(
    `/api/dailymed-proxy?mode=label&sid=${encodeURIComponent(setId)}`,
  );
  if (!response.ok) return null;
  return response.json();
}
