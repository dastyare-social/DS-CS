import { capitalize } from "@/lib/utils";
import { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import React from "react";
import { app_config, app_url } from "@/config/app";
import { Locale } from "@/config/locale";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;

  return {
    metadataBase: new URL(app_url),
    title: capitalize(t("general.explore")),
    description: `Explore amazing content, shorts, and conversations from ${app_config[locale].name}!`,
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      title: capitalize(t("general.explore")),
      description: `Explore amazing content, shorts, and conversations from ${app_config[locale].name}!`,
      url: `${app_url}/explore`,
      siteName: t("general.app_name", { owner_name: app_config[locale].name }),
      locale,
      type: "website",
      images: [
        {
          url: `${app_url}/api/og/explore`,
          width: 1200,
          height: 630,
          alt: "Explore",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: capitalize(t("general.explore")),
      description: `Explore amazing content, shorts, and conversations from ${app_config[locale].name}!`,
      images: [`${app_url}/api/og/explore`],
    },
  };
}

export default function layout({ children }: { children: React.ReactNode }) {
  return children;
}
