import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Netlify's OpenNext adapter owns the deployment output. Keep standalone
  // output for Docker and other self-hosted production builds only.
  output: process.env.NETLIFY ? undefined : "standalone",
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
