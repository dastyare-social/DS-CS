import React from 'react';
import { Metadata } from 'next';
import { app_config, app_url } from '@/config/app';
import { Locale } from '@/config/locale';
import { getLocale, getTranslations } from 'next-intl/server';
import { PersonSchema, CollectionPageSchema } from '@/components/seo';
import MainLayoutWrapper from '@/components/main-layout-wrapper';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;

  const title = `${app_config[locale].name}'s Channel`;
  const description = app_config[locale].desc;

  return {
    metadataBase: new URL(app_url),
    title,
    description,
    openGraph: {
      title,
      description,
      url: app_url,
      siteName: t("general.app_name", { owner_name: app_config[locale].name }),
      locale,
      type: 'website',
      images: [
        {
          url: `${app_url}/profile-image.png`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${app_url}/profile-image.png`],
    },
    alternates: {
      canonical: app_url,
    },
  };
}

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = (await getLocale()) as Locale;

  return (
    <>
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
