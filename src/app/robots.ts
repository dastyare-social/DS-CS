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
        allow: '/',
        // /os/ (admin OS) is fully private. /api/ endpoints are excluded from
        // crawling to avoid leaking internal API surface; they are still
        // reachable programmatically (see /openapi.json and /docs).
        //
        // NOTE: /agents.md, /docs/ and /posts are intentionally NOT disallowed.
        // They are already X-Robots-Tag: noindex via next.config.ts headers,
        // which keeps them out of search results while remaining crawlable by
        // LLM agents (GPTBot/ClaudeBot respect robots.txt and need /agents.md
        // and /docs for LLM/MCP tool discovery). Post pages are the primary
        // indexable content and are listed in the sitemap.
        disallow: ['/os/', '/api/'],
      },
    ],
    sitemap: `${app_url}/sitemap.xml`,
  }
}