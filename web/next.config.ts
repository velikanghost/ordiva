import type { NextConfig } from "next";

const apiUrl = process.env.ORDIVA_API_URL ?? "http://localhost:4100";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
