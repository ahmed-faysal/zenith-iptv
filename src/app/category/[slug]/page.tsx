import { BrowseView } from "@/components/BrowseView";
import type { AppCategory } from "@/lib/types";

const VALID: AppCategory[] = ["News", "Sports", "Entertainment", "Music", "Kids", "Other"];

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = VALID.find((c) => c.toLowerCase() === slug.toLowerCase());
  if (!cat) return null;
  return <BrowseView category={cat} />;
}
