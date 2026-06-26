import type { NextConfig } from "next";

// In the webOS build the app is served from file:// inside the .ipk, so every
// asset must be referenced relatively. `assetPrefix: "."` turns the default
// absolute "/_next/..." references into "./_next/...", which resolve correctly
// because every exported page sits at the package root (index/watch/category/
// search.html). The web build keeps Next's default absolute paths.
const nextConfig: NextConfig = {
  ...(process.env.WEBOS_BUILD === "1" && {
    output: "export",
    assetPrefix: ".",
  }),
};

export default nextConfig;
