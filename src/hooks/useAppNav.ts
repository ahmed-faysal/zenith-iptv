"use client";
import { useRouter } from "next/navigation";

// In a packaged webOS build the app runs from file:// with no server, so Next's
// client-side router (which fetches RSC payloads over absolute paths) cannot
// navigate between screens. Instead we hard-navigate to the statically exported
// HTML files using relative paths, which resolve correctly under file://.
// On the web build this is a thin pass-through to the real Next router.
const WEBOS = process.env.NEXT_PUBLIC_WEBOS === "1";

// Map an app route to its exported static file, e.g.
//   "/"                  -> "./index.html"
//   "/watch?id=CNN%40HD" -> "./watch.html?id=CNN%40HD"
//   "/category?slug=news"-> "./category.html?slug=news"
//   "/search"            -> "./search.html"
export function toStaticHref(path: string): string {
  if (path === "/" || path === "") return "./index.html";
  const [route, query] = path.replace(/^\//, "").split("?");
  return `./${route}.html${query ? `?${query}` : ""}`;
}

export type AppNav = {
  push: (path: string) => void;
  back: () => void;
  refresh: () => void;
};

export function useAppNav(): AppNav {
  const router = useRouter();
  if (!WEBOS) {
    return {
      push: (p) => router.push(p),
      back: () => router.back(),
      refresh: () => router.refresh(),
    };
  }
  return {
    push: (p) => window.location.assign(toStaticHref(p)),
    back: () => window.history.back(),
    refresh: () => window.location.reload(),
  };
}
