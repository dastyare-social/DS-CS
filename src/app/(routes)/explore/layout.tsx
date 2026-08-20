import { Metadata } from "next";
import { getLocale } from "next-intl/server";
import React from "react";
import { Locale } from "@/config/locale";
import { exploreMetadata } from "../../../../config/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  return exploreMetadata(locale);
}

export default function layout({ children }: { children: React.ReactNode }) {
  return children;
}
