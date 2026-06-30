import { NextResponse } from "next/server";
import type { Channel } from "@/lib/types";
import curated from "@/data/curated.json";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=3600",
};

// Curated-only: serve the locally-validated catalogue (src/data/curated.json).
// No live source merge at request time — the list is refreshed by running
// `npm run validate` locally and committing the result. See
// docs/superpowers/specs/2026-06-30-curated-catalogue-design.md.
export function GET() {
  const channels = (curated as { channels: Channel[] }).channels ?? [];
  return NextResponse.json({ channels }, { headers: HEADERS });
}
