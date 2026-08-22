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
