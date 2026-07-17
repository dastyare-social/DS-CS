import type { NextConfig } from "next";

import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

const nextConfig: NextConfig = {
  serverExternalPackages: ["@takumi-rs/core", "takumi-js"],
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "9001",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "storage.iran.liara.space",
        pathname: "/**",
      },
    ],
  },
  allowedDevOrigins: [
    "::1",
    "127.0.0.1",
    "cs.dastyare.social",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
    ];
  },
  devIndicators: false,
};

export default withNextIntl(nextConfig);
