"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { WatchView } from "@/components/WatchView";

function Watch() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  return <WatchView channelId={decodeURIComponent(id)} />;
}

export default function Page() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Loading…</p>}>
      <Watch />
    </Suspense>
  );
}
