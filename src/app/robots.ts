import type { MetadataRoute } from 'next'
import { app_url } from '@/config/app'

const allowIndexing = process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true'

export default function robots(): MetadataRoute.Robots {
  // When indexing is globally disabled, block all crawling and stop
  // advertising a sitemap.
  if (!allowIndexing) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/api/og/'],
        disallow: ['/os/', '/api/'],
      },
    ],
    sitemap: `${app_url}/sitemap.xml`,
  }
}