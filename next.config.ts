import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright must stay external — it can't be bundled into the server build.
  serverExternalPackages: ["playwright", "playwright-core"],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
