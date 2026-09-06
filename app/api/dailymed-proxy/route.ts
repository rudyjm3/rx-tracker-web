import { NextResponse } from "next/server";

const DAILYMED_BASE = "https://dailymed.nlm.nih.gov/dailymed/services/v2/";
const OPENFDA_DRUG_LABEL_BASE = "https://api.fda.gov/drug/label.json";
const SID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function drugNameSuggestionsUrl(drugName: string) {
  const query = encodeURIComponent(`${drugName}*`);
  return `${OPENFDA_DRUG_LABEL_BASE}?search=(openfda.brand_name:${query}+OR+openfda.generic_name:${query})&limit=10`;
}

function normalizeDrugNameSuggestions(data: unknown, drugName: string) {
  const queryUpper = drugName.toUpperCase();
  const seen = new Set<string>();
  const suggestions: { setid: string; title: string }[] = [];

  const results =
    data && typeof data === "object" && "results" in data
      ? (data as { results?: unknown[] }).results
      : [];

  for (const result of results ?? []) {
    if (!result || typeof result !== "object" || !("openfda" in result)) continue;

    const openfda = (result as { openfda?: { brand_name?: unknown[]; generic_name?: unknown[] } })
      .openfda;
    const names = [...(openfda?.brand_name ?? []), ...(openfda?.generic_name ?? [])];

    for (const name of names) {
      if (typeof name !== "string") continue;
      const key = name.toUpperCase();
      if (seen.has(key) || !key.includes(queryUpper)) continue;
      seen.add(key);
      suggestions.push({ setid: key, title: name });
    }
  }

  return { data: suggestions };
}

// Never accepts a client-supplied URL or host — only structured params
// that this route uses to build the exact upstream URL itself. That
// makes SSRF structurally impossible rather than relying on an allowlist
// check against a caller-provided string.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");

  let upstreamUrl: string;
  let normalizeResponse: ((data: unknown) => unknown) | null = null;

  switch (mode) {
    case "search": {
      const drugName = (searchParams.get("drug_name") ?? "").trim();
      if (!drugName || drugName.length > 200) {
        return NextResponse.json(
          { error: "drug_name is required (max 200 chars)" },
          { status: 400 },
        );
      }
      upstreamUrl = drugNameSuggestionsUrl(drugName);
      normalizeResponse = (data) => normalizeDrugNameSuggestions(data, drugName);
      break;
    }
    case "media": {
      const sid = searchParams.get("sid") ?? "";
      if (!SID_PATTERN.test(sid)) {
        return NextResponse.json(
          { error: "sid must be a valid DailyMed set id" },
          { status: 400 },
        );
      }
      upstreamUrl = `${DAILYMED_BASE}spls/${sid}/media.json`;
      break;
    }
    default:
      return NextResponse.json(
        { error: "mode must be 'search' or 'media'" },
        { status: 400 },
      );
  }

  try {
    const response = await fetch(upstreamUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "DailyMed upstream error" },
        { status: 502 },
      );
    }

    const data = await response.json();
    return NextResponse.json(normalizeResponse ? normalizeResponse(data) : data);
  } catch {
    return NextResponse.json(
      { error: "DailyMed request failed or timed out" },
      { status: 504 },
    );
  }
}
