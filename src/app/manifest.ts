import type { MetadataRoute } from 'next';
import { app_config } from '@/config/app';
import { getLocale } from 'next-intl/server';
import { Locale } from '@/config/locale';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = (await getLocale()) as Locale;
  const appName = app_config[locale].name;
  const appDescription = app_config[locale].desc;

  return {
    id: "/",
    name: appName,
    short_name: appName,
    description: appDescription,
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    screenshots: [
      {
        src: "/screenshots/wide-1280x720.png",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide",
      },
      {
        src: "/screenshots/mobile-750x1334.png",
        sizes: "750x1334",
        type: "image/png",
      },
    ],
  };
}