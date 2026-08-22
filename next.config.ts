import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Kalkylatorn flyttade in under Ekonomi 2026-08-22
    return [
      { source: "/kalkylator", destination: "/ekonomi/kalkyl", permanent: true },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
