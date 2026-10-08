import { NextResponse } from "next/server";
import {
  ndcSearchUrl,
  ndcStrengthUrl,
  normalizeNdcProducts,
  parseSearchTerm,
  pickSetIdForStrength,
  toSuggestions,
} from "@/lib/dailymed-ndc";

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

function drugLabelBySetIdUrl(sid: string) {
  // DailyMed's own spls/{setid}.json returns 415, and its XML has no
  // section-level JSON; openFDA's label endpoint is keyed by the same SPL
  // set id and has the section fields the details modal renders.
  return `${OPENFDA_DRUG_LABEL_BASE}?search=${encodeURIComponent(`set_id:"${sid}"`)}&limit=1`;
}

function drugLabelUrl(drugName: string) {
  const query = encodeURIComponent(drugName);
  return `${OPENFDA_DRUG_LABEL_BASE}?search=(openfda.brand_name:${query}+OR+openfda.generic_name:${query})&limit=1`;
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
  // openFDA answers a query with no matches as HTTP 404 NOT_FOUND. For the
  // NDC modes that's an empty result, not an upstream failure.
  let notFoundIsEmpty: unknown = undefined;

  switch (mode) {
    case "ndc_search": {
      const term = (searchParams.get("drug_name") ?? "").trim();
      if (!term || term.length > 200) {
        return NextResponse.json(
          { error: "drug_name is required (max 200 chars)" },
          { status: 400 },
        );
      }
      const { words, strength } = parseSearchTerm(term);
      if (words.length === 0) return NextResponse.json({ data: [] });
      upstreamUrl = ndcSearchUrl(words);
      normalizeResponse = (data) => ({
        data: toSuggestions(normalizeNdcProducts(data), strength).map((s) => ({
          label: s.label,
          name: s.name,
          doseAmount: s.doseAmount,
          doseUnit: s.doseUnit,
          setId: s.setId,
        })),
      });
      notFoundIsEmpty = { data: [] };
      break;
    }
    case "ndc_match": {
      const drugName = (searchParams.get("drug_name") ?? "").trim();
      if (!drugName || drugName.length > 200) {
        return NextResponse.json(
          { error: "drug_name is required (max 200 chars)" },
          { status: 400 },
        );
      }
      const rawAmount = searchParams.get("dose_amount");
      const doseAmount = rawAmount ? Number(rawAmount) : null;
      if (doseAmount != null && !(Number.isFinite(doseAmount) && doseAmount > 0)) {
        return NextResponse.json({ error: "dose_amount must be a positive number" }, { status: 400 });
      }
      const doseUnit = (searchParams.get("dose_unit") ?? "").trim().slice(0, 20) || null;
      return handleNdcMatch(drugName, doseAmount, doseUnit);
    }
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
    case "label": {
      const sid = searchParams.get("sid");
      if (sid) {
        if (!SID_PATTERN.test(sid)) {
          return NextResponse.json(
            { error: "sid must be a valid DailyMed set id" },
            { status: 400 },
          );
        }
        upstreamUrl = drugLabelBySetIdUrl(sid);
        break;
      }
      const drugName = (searchParams.get("drug_name") ?? "").trim();
      if (!drugName || drugName.length > 200) {
        return NextResponse.json(
          { error: "drug_name is required (max 200 chars)" },
          { status: 400 },
        );
      }
      upstreamUrl = drugLabelUrl(drugName);
      break;
    }
    default:
      return NextResponse.json(
        { error: "mode must be 'search', 'ndc_search', 'ndc_match', 'media', or 'label'" },
        { status: 400 },
      );
  }

  try {
    const response = await fetch(upstreamUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status === 404 && notFoundIsEmpty !== undefined) {
      return NextResponse.json(notFoundIsEmpty);
    }
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

async function fetchNdc(url: string): Promise<unknown | null> {
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`openFDA NDC ${response.status}`);
  return response.json();
}

// Resolves the SPL set id for a stored medication that has none saved:
// ask the NDC directory for listings of that exact strength first, then for
// any listing of the drug, and only then take the first listing with an SPL.
async function handleNdcMatch(drugName: string, doseAmount: number | null, doseUnit: string | null) {
  try {
    const strengthData = await fetchNdc(ndcStrengthUrl(drugName, doseAmount, doseUnit));
    let match = pickSetIdForStrength(normalizeNdcProducts(strengthData), doseAmount, doseUnit);
    if (!match?.exact) {
      const nameData = await fetchNdc(ndcStrengthUrl(drugName));
      const byName = pickSetIdForStrength(normalizeNdcProducts(nameData), doseAmount, doseUnit);
      if (byName && (byName.exact || !match)) match = byName;
    }
    return NextResponse.json({ data: match });
  } catch {
    return NextResponse.json(
      { error: "DailyMed request failed or timed out" },
      { status: 504 },
    );
  }
}
