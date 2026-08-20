import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { checkAuth } from "@/lib/auth/utils";
import React from "react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  const title = t("general.panel");
  return {
    title: {
      default: title,
      template: `%s — ${title}`,
    },
  };
}

export default async function layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await checkAuth();

  return children;
}
