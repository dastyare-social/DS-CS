import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import "@/styles/globals.css";

import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { LangDir, LangFont } from "@/lib/fonts";
import NextTopLoader from "nextjs-toploader";
import { cn } from "@/lib/utils";
import { Locale } from "@/config/locale";
import { rootMetadata } from "../../../config/metadata";
import Analytics from "@/components/analytics";
import RegisterPWA from "@/components/register-pwa";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

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

  // Preload through React's resource API, not an explicit <head>. React hoists
  // this link and reconciles it the same on the server and the client, so it
  // does not conflict with the JSON-LD scripts during hydration.
  preload("/profile-image.png", { as: "image" });

  return (
    <html lang={locale} dir={dir}>
      <body
        suppressHydrationWarning
        className={cn(
          font,
          "antialiased tracking-tighter select-none w-full flex justify-center",
        )}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <NextTopLoader
            color="var(--color-primary)"
            showSpinner={false}
            shadow="none"
          />
          <Analytics />
          <RegisterPWA />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
