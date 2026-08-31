import type { NextConfig } from "next";

import createNextIntlPlugin from "next-intl/plugin";
import { withPostHogConfig } from "@posthog/nextjs-config";

// Define RemotePattern type inline since it might not be exported in Next.js 16
type RemotePattern = {
  protocol: "http" | "https";
  hostname: string;
  port?: string;
  pathname: string;
};

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

// Serwist is disabled — we maintain public/sw.js by hand.
// On Turbopack (Next.js 16 default) Serwist's webpack plugin never runs anyway.
// On Vercel with next build (webpack) it WOULD overwrite public/sw.js, so we
// wrap with a no-op passthrough instead.
const withSerwist = (_config: NextConfig) => _config;

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
    .split(",")
    .map((domain) => domain.trim())
    .filter((domain) => domain.length > 0)
    .map((domain) => {
      // If domain doesn't have protocol, assume https
      const urlStr = domain.includes("://") ? domain : `https://${domain}`;
      const pattern = patternFromUrl(urlStr);
      if (!pattern) {
        console.warn(
          `Invalid image domain in NEXT_PUBLIC_ADDITIONAL_IMAGE_DOMAINS: "${domain}"`,
        );
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
  allowedDevOrigins: ["::1", "127.0.0.1", "cs.dastyare.social"],
  async rewrites() {
    const s3PublicBase = process.env.S3_PUBLIC_BASE_URL?.replace(/\/+$/, "");
    const s3Endpoint = process.env.S3_ENDPOINT?.replace(/\/+$/, "");
    const s3Bucket = process.env.S3_BUCKET_NAME || "";

    // Derive the public base URL for animated emoji .webp files
    let emojiBaseUrl: string | null = null;
    if (s3PublicBase) {
      emojiBaseUrl = s3PublicBase;
    } else if (s3Endpoint) {
      emojiBaseUrl = `${s3Endpoint}/${s3Bucket}`;
    }

    if (!emojiBaseUrl) return [];

    return [
      {
        source: "/animated-emojies/:path*",
        destination: `${emojiBaseUrl}/animated-emojies/:path*`,
        has: [
          {
            type: "header",
            key: "accept",
            value: ".*",
          },
        ],
      },
    ];
  },
  async headers() {
    const allowIndexing = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";

    const robotsHeader = {
      key: "X-Robots-Tag",
      value: "noindex, nofollow, noarchive",
    };

    // Routes that should NEVER be indexed (admin/internal/API/diagnostic pages)
    const alwaysNoIndex = [
      "/os/(.*)", // operator/admin UI
      "/api/(.*)", // API endpoints
      "/agents.md", // agent guidance page
      "/docs/(.*)", // interactive docs (optional private)
      "/posts", // posts listing page (doesn't exist, only /[post_id] does)
    ].map((source) => ({ source, headers: [robotsHeader] }));

    const swHeaders = {
      source: "/sw.js",
      headers: [
        {
          key: "Content-Security-Policy",
          value: "default-src 'self'; script-src 'self'",
        },
      ],
    };

    if (!allowIndexing) {
      // Block everything by default, but keep explicit alwaysNoIndex entries for clarity
      return [
        ...alwaysNoIndex,
        {
          source: "/(.*)",
          headers: [robotsHeader],
        },
        swHeaders,
      ];
    }

    // Indexing allowed globally, but still ensure sensitive routes remain blocked.
    return [...alwaysNoIndex, swHeaders];
  },
  devIndicators: false,
};

// Upload browser source maps to PostHog during `next build` so error tracking
// resolves minified frames to real files. Only enable when the personal API key
// and project id are present, so builds without those credentials still pass.
// Works under Turbopack (the Next.js 16 default): withPostHogConfig sets
// productionBrowserSourceMaps and uploads through the compiler hook.
const posthogSourcemapsEnabled = Boolean(
  process.env.PH_PERSONAL_API_KEY && process.env.PH_PROJECT_ID,
);

export default withPostHogConfig(withSerwist(withNextIntl(nextConfig)), {
  personalApiKey: process.env.PH_PERSONAL_API_KEY ?? "",
  projectId: process.env.PH_PROJECT_ID,
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  sourcemaps: { enabled: posthogSourcemapsEnabled },
});
