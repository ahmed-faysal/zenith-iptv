import { WatchView } from "@/components/WatchView";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WatchView channelId={decodeURIComponent(id)} />;
}
