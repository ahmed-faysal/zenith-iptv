import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.WEBOS_BUILD === "1" && { output: "export" }),
};

export default nextConfig;
