import "@/styles/globals.css";

import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { LangDir, LangFont } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import NotFoundGetBackHomeButton from "@/components/not-found-get-back-home-button";
import { Metadata } from "next";
import { notFoundMetadata } from "../../config/metadata";
import type { Locale } from "@/config/locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  return notFoundMetadata(locale);
}

export default async function GlobalNotFound() {
  const locale = await getLocale();

  const messages = await getMessages();

  const font = LangFont(locale);
  const dir = LangDir(locale);

  const tNotFound = await getTranslations("not_found");

  return (
    <html lang={locale} dir={dir}>
      <body
        className={cn(
          font,
          "antialiased tracking-tighter px-5 py-5 md:h-screen flex justify-center items-center select-none",
        )}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <div className="w-full md:max-w-xs flex flex-col justify-center items-center gap-y-5 px-5 py-5 rounded-3xl border-2 border-dashed border-primary/5 bg-primary/3">
            <div className="text-center">{tNotFound("description")}</div>

            <NotFoundGetBackHomeButton />
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
