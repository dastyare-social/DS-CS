import type { MetadataRoute } from 'next';
import { app_config } from '@/config/app';
import { getLocale } from 'next-intl/server';
import { Locale } from '@/config/locale';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = (await getLocale()) as Locale;
  const appName = app_config[locale].name;
  const appDescription = app_config[locale].desc;

  return {
    name: appName,
    short_name: appName,
    description: appDescription,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: '/profile_image.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/profile_image.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}