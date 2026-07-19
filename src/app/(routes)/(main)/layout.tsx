import React from 'react';
import { app_config, app_url } from '@/config/app';
import { Locale } from '@/config/locale';
import { getLocale } from 'next-intl/server';
import { PersonSchema } from '@/components/seo';
import MainLayoutWrapper from '@/components/main-layout-wrapper';

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
      <MainLayoutWrapper>{children}</MainLayoutWrapper>
    </>
  );
}
