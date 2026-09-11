import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { app_url } from '@/config/app'

// robots.txt depends on the request host, so it must be generated at request
// time rather than during `next build` (where env and host are not final).
export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  // When indexing is globally disabled, block all crawling and stop
  // advertising a sitemap.
  if (process.env.NEXT_PUBLIC_ALLOW_INDEXING !== 'true') {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    }
  }

  // Derive the site URL from the actual request so the advertised sitemap URL
  // matches the host a crawler is hitting (falling back to the configured URL).
  const requestHeaders = await headers()
  const proto = requestHeaders.get('x-forwarded-proto') ?? 'http'
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const baseUrl = host ? `${proto}://${host}` : app_url

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/api/og/'],
        disallow: ['/os/', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}