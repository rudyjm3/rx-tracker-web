import { NextResponse } from "next/server";

const DAILYMED_BASE = "https://dailymed.nlm.nih.gov/dailymed/services/v2/";
const SID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Never accepts a client-supplied URL or host — only structured params
// that this route uses to build the exact upstream URL itself. That
// makes SSRF structurally impossible rather than relying on an allowlist
// check against a caller-provided string.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");

  let upstreamUrl: string;

  switch (mode) {
    case "search": {
      const drugName = (searchParams.get("drug_name") ?? "").trim();
      if (!drugName || drugName.length > 200) {
        return NextResponse.json(
          { error: "drug_name is required (max 200 chars)" },
          { status: 400 },
        );
      }
      upstreamUrl = `${DAILYMED_BASE}spls.json?drug_name=${encodeURIComponent(drugName)}&pagesize=8`;
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
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "DailyMed request failed or timed out" },
      { status: 504 },
    );
  }
}
