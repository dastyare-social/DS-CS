import React from "react";
import { Metadata } from "next";
import { app_config, app_url } from "@/config/app";
import { Locale } from "@/config/locale";
import { getLocale } from "next-intl/server";
import { PersonSchema, CollectionPageSchema, WebSiteSchema } from "@/components/seo";
import MainLayoutWrapper from "@/components/main-layout-wrapper";
import { homeMetadata } from "../../../../config/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  return homeMetadata(locale);
}

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = (await getLocale()) as Locale;

  return (
    <>
      <WebSiteSchema
        name={app_config[locale].name}
        url={app_url}
        description={app_config[locale].desc}
      />
      <PersonSchema
        name={app_config[locale].name}
        url={app_url}
        image={`${app_url}/profile-image.png`}
        email={app_config.general.email}
      />
      <CollectionPageSchema
        name={`${app_config[locale].name}'s Channel`}
        description={app_config[locale].desc}
        url={app_url}
        author={{
          name: app_config[locale].name,
          url: app_url,
        }}
      />
      <MainLayoutWrapper>{children}</MainLayoutWrapper>
    </>
  );
}
