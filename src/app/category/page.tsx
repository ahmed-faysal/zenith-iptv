"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BrowseView } from "@/components/BrowseView";
import type { AppCategory } from "@/lib/types";

const VALID: AppCategory[] = ["News", "Sports", "Entertainment", "Music", "Kids", "Other"];

function Category() {
  const params = useSearchParams();
  const slug = params.get("slug") ?? "";
  const cat = VALID.find((c) => c.toLowerCase() === slug.toLowerCase());
  if (!cat) return null;
  return <BrowseView category={cat} />;
}

export default function Page() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Loading…</p>}>
      <Category />
    </Suspense>
  );
}
