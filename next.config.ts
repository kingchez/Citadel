import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The old per-project dashboards were merged into the single Dashboard at "/".
  async redirects() {
    return [
      { source: "/pipeline/dashboard", destination: "/", permanent: true },
      { source: "/news/dashboard", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
