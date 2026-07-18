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

export default withSerwist(withNextIntl(nextConfig));
