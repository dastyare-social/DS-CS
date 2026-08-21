import type { Metadata } from "next";
import "@/styles/globals.css";

import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { LangDir, LangFont } from "@/lib/fonts";
import NextTopLoader from "nextjs-toploader";
import { cn } from "@/lib/utils";
import { Locale } from "@/config/locale";
import { rootMetadata } from "../../../config/metadata";
import Analytics from "@/components/analytics";
import OfflineIndicator from "@/components/offline-indicator";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  return rootMetadata(locale);
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
          <OfflineIndicator />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
