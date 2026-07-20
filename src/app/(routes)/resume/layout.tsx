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
    title: `Resume — ${app_config[locale].name}`,
    description: `Resume of ${app_config[locale].name}`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function layout({
    children
}: {
    children: React.ReactNode
}) {
  return children
}
