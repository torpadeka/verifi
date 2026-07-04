import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright must stay external — it can't be bundled into the server build.
  serverExternalPackages: ["playwright", "playwright-core"],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Runtime writes screenshots/JSON into .data — keep the dev watcher off it so
  // a run's file churn can't trigger a recompile storm.
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules/**", "**/.git/**", "**/.data/**"],
    };
    return config;
  },
};

export default nextConfig;
