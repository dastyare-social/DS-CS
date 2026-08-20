import type { Metadata } from "next";
import "@/styles/globals.css";

import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { LangDir, LangFont } from "@/lib/fonts";
import NextTopLoader from "nextjs-toploader";
import { cn } from "@/lib/utils";
import { app_config, app_url } from "@/config/app";
import { Locale } from "@/config/locale";
import Analytics from "@/components/analytics";
import PwaInstall from "@/components/pwa-install";
import OfflineIndicator from "@/components/offline-indicator";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;

  return {
    metadataBase: new URL(app_url),
    title: {
      default: t("general.app_name", { owner_name: app_config[locale].name }),
      template:
        "%s — " +
        t("general.app_name", { owner_name: app_config[locale].name }),
    },
    description: app_config[locale].desc,
    openGraph: {
      title: t("general.app_name", { owner_name: app_config[locale].name }),
      description: app_config[locale].desc,
      url: app_url,
      siteName: t("general.app_name", { owner_name: app_config[locale].name }),
      locale: locale,
      type: "website",
      images: [
        {
          url: `${app_url}/api/og/home`,
          width: 1200,
          height: 630,
          alt: app_config[locale].name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("general.app_name", { owner_name: app_config[locale].name }),
      description: app_config[locale].desc,
      images: [`${app_url}/api/og/home`],
    },
    alternates: {
      canonical: app_url,
    },
    ...(process.env.NEXT_PUBLIC_ENABLE_SEARCH_CONSOLE === 'true' &&
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
      ? {
          verification: {
            google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
          },
        }
      : {}),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  const messages = await getMessages();

  const font = LangFont(locale);
  const dir = LangDir(locale);

  return (
    <html lang={locale} dir={dir}>
      <body
        suppressHydrationWarning
        className={cn(
          font,
          "antialiased tracking-tighter select-none w-full flex justify-center"
        )}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <NextTopLoader
            color="var(--color-primary)"
            showSpinner={false}
            shadow="none"
          />
          <Analytics />
          <PwaInstall />
          <OfflineIndicator />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
