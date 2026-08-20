import type { Metadata } from "next";
import { app_config, app_url } from "../src/config/app";
import type { Locale } from "../src/config/locale";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OG_IMAGE = `${app_url}/profile-image.png`;
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

function appName(locale: Locale) {
  return `${app_config[locale].name}'s Channel`;
}

function siteName(locale: Locale) {
  return appName(locale);
}

function ogImages(url: string, alt: string) {
  return [{ url, width: OG_WIDTH, height: OG_HEIGHT, alt }] as NonNullable<
    Metadata["openGraph"]
  >["images"];
}

// ---------------------------------------------------------------------------
// Page metadata definitions
// ---------------------------------------------------------------------------

export function rootMetadata(locale: Locale): Metadata {
  const title = appName(locale);
  const description = app_config[locale].desc;

  return {
    metadataBase: new URL(app_url),
    title: {
      default: title,
      template: `%s — ${title}`,
    },
    description,
    openGraph: {
      title,
      description,
      url: app_url,
      siteName: siteName(locale),
      locale,
      type: "website",
      images: ogImages(OG_IMAGE, title),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE],
    },
    alternates: {
      canonical: app_url,
    },
    ...(process.env.NEXT_PUBLIC_ENABLE_SEARCH_CONSOLE === "true" &&
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
      ? {
          verification: {
            google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
          },
        }
      : {}),
  };
}

export function homeMetadata(locale: Locale): Metadata {
  const title = appName(locale);
  const description = app_config[locale].desc;

  return {
    metadataBase: new URL(app_url),
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      url: app_url,
      siteName: siteName(locale),
      locale,
      type: "website",
      images: ogImages(OG_IMAGE, title),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE],
    },
    alternates: {
      canonical: app_url,
    },
  };
}

export function exploreMetadata(locale: Locale): Metadata {
  const title = "Explore";
  const description = `Explore amazing content, shorts, and conversations from ${app_config[locale].name}!`;

  return {
    metadataBase: new URL(app_url),
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: `${app_url}/explore`,
      siteName: siteName(locale),
      locale,
      type: "website",
      images: ogImages(OG_IMAGE, title),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE],
    },
    alternates: {
      canonical: `${app_url}/explore`,
    },
  };
}

export function postMetadata(
  locale: Locale,
  opts: {
    post_id: string;
    pageTitle: string;
    description: string;
  },
): Metadata {
  const { post_id, pageTitle, description } = opts;
  const ogUrl = `${app_url}/api/og/posts/${post_id}`;

  return {
    metadataBase: new URL(app_url),
    title: pageTitle,
    description,
    openGraph: {
      title: pageTitle,
      description,
      url: `${app_url}/posts/${post_id}`,
      siteName: siteName(locale),
      locale,
      type: "article",
      images: ogImages(ogUrl, pageTitle),
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
      images: [ogUrl],
    },
    alternates: {
      canonical: `${app_url}/posts/${post_id}`,
    },
  };
}

export function resumeMetadata(locale: Locale): Metadata {
  const title = `Resume — ${app_config[locale].name}`;
  const description = `Resume of ${app_config[locale].name}`;

  return {
    metadataBase: new URL(app_url),
    title,
    description,
    robots: { index: false, follow: false },
    alternates: {
      canonical: `${app_url}/resume`,
    },
  };
}

export function panelMetadata(): Metadata {
  return {
    robots: { index: false, follow: false },
  };
}

export function notFoundMetadata(locale: Locale): Metadata {
  return {
    title: `Not Found — ${appName(locale)}`,
  };
}
