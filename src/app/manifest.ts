import type { MetadataRoute } from "next";
import { get_app_config } from "@/config/runtime";
import { getLocale } from "next-intl/server";
import { Locale } from "@/config/locale";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = (await getLocale()) as Locale;
  const app_config = get_app_config();
  const appName = app_config[locale].name;
  const appDescription = app_config[locale].desc;

  return {
    id: "/",
    name: `${appName}'s Channel`,
    short_name: appName,
    // description: appDescription,
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    // No `screenshots` entry on purpose. Browsers that support it (Chrome on
    // Android/Desktop) render those images as preview cards inside the install
    // prompt. Omitting the key leaves the dialog screenshot-free instead of
    // showing stale captures of the UI.
  };
}
