import { NextResponse } from "next/server";
import type { Channel } from "@/lib/types";
import { resolveCatalogue } from "@/lib/catalogue";
import { getChannels } from "@/lib/source";
import curated from "@/data/curated.json";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=3600",
};

// Curated-first: serve the locally-validated catalogue (src/data/curated.json),
// refreshed by running `npm run validate` locally and committing the result.
// See docs/superpowers/specs/2026-06-30-curated-catalogue-design.md.
// An empty curated file falls back to the live source merge — see catalogue.ts.
export async function GET() {
  const seed = (curated as { channels: Channel[] }).channels ?? [];
  const channels = await resolveCatalogue(seed, getChannels);
  return NextResponse.json({ channels }, { headers: HEADERS });
}
