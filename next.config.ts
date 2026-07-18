import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import type { NextConfig } from "next";

import createNextIntlPlugin from "next-intl/plugin";
import withSerwistInit from "@serwist/next";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" })
    .stdout?.trim() ?? crypto.randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  register: false,
  disable: process.env.NODE_ENV !== "production",
  cacheOnNavigation: true,
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
});

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
    "172.20.10.3",
    "cs.dastyare.social",
  ],
  async headers() {
    const allowIndexing = process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true'

    const robotsHeader = {
      key: "X-Robots-Tag",
      value: "noindex, nofollow, noarchive",
    }

    // Routes that should NEVER be indexed (admin/internal/API/diagnostic pages)
    const alwaysNoIndex = [
      "/os/(.*)", // operator/admin UI
      "/api/(.*)", // API endpoints
      "/~offline", // offline page
      "/pwa-self-test", // PWA test page
      "/agents.md", // agent guidance page
      "/docs/(.*)", // interactive docs (optional private)
    ].map((source) => ({ source, headers: [robotsHeader] }))

    if (!allowIndexing) {
      // Block everything by default, but keep explicit alwaysNoIndex entries for clarity
      return [
        ...alwaysNoIndex,
        {
          source: "/(.*)",
          headers: [robotsHeader],
        },
      ];
    }

    // Indexing allowed globally, but still ensure sensitive routes remain blocked.
    return [...alwaysNoIndex];
  },
  devIndicators: false,
};

export default withSerwist(withNextIntl(nextConfig));
