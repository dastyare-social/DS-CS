import type { MetadataRoute } from 'next'
import { app_url } from '@/config/app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/os/', '/api/', '/agents.md', '/docs/', '/posts'],
      },
    ],
    sitemap: `${app_url}/sitemap.xml`,
  }
}