import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import type { NextConfig } from "next";

import createNextIntlPlugin from "next-intl/plugin";
import withSerwistInit from "@serwist/next";

// Define RemotePattern type inline since it might not be exported in Next.js 16
type RemotePattern = {
  protocol: 'http' | 'https';
  hostname: string;
  port?: string;
  pathname: string;
};

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

// Build a remotePattern entry from an arbitrary URL string (e.g. S3_ENDPOINT).
// Returns null if the value is empty or not a valid URL.
function patternFromUrl(raw: string | undefined): RemotePattern | null {
  if (!raw?.trim()) return null;
  try {
    const { protocol, hostname, port } = new URL(raw.trim());
    const proto = protocol.replace(":", "") as "http" | "https";
    return {
      protocol: proto,
      hostname,
      ...(port ? { port } : {}),
      // Allow any path under this host (storage keys are unpredictable)
      pathname: "/**",
    };
  } catch {
    return null;
  }
}

// Parse comma-separated list of additional image domains from environment
function parseAdditionalDomains(): RemotePattern[] {
  const raw = process.env.NEXT_PUBLIC_ADDITIONAL_IMAGE_DOMAINS;
  if (!raw?.trim()) return [];
  
  return raw
    .split(',')
    .map(domain => domain.trim())
    .filter(domain => domain.length > 0)
    .map(domain => {
      // If domain doesn't have protocol, assume https
      const urlStr = domain.includes('://') ? domain : `https://${domain}`;
      const pattern = patternFromUrl(urlStr);
      if (!pattern) {
        console.warn(`Invalid image domain in NEXT_PUBLIC_ADDITIONAL_IMAGE_DOMAINS: "${domain}"`);
      }
      return pattern;
    })
    .filter((p): p is RemotePattern => p !== null);
}

const s3Pattern =
  patternFromUrl(process.env.S3_PUBLIC_BASE_URL) ??
  patternFromUrl(process.env.S3_ENDPOINT);

const additionalDomains = parseAdditionalDomains();

const remotePatterns: RemotePattern[] = [
  // Local MinIO / dev S3
  {
    protocol: "http",
    hostname: "localhost",
    port: "9001",
    pathname: "/**",
  },
  // Include the S3 host explicitly
  ...(s3Pattern ? [s3Pattern] : []),
  // Include additional domains from environment
  ...additionalDomains,
  // For development/testing - allow localhost on any port
  {
    protocol: "http",
    hostname: "127.0.0.1",
    pathname: "/**",
  },
  {
    protocol: "http",
    hostname: "0.0.0.0",
    pathname: "/**",
  },
  {
    protocol: "http",
    hostname: "::1",
    pathname: "/**",
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@takumi-rs/core", "takumi-js"],
  images: {
    remotePatterns,
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
