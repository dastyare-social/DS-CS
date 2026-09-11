import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { app_url } from '@/config/app'
import { isResumeEnabled } from '@/config/resume'
import { getPostsWithReactions } from '@/lib/api/posts/queries'

// The sitemap depends on live post data, so it must be generated at request
// time rather than during `next build` (where no database is available in CI).
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // When indexing is globally disabled, expose an empty sitemap. robots.txt
  // also stops advertising it in that mode.
  if (process.env.NEXT_PUBLIC_ALLOW_INDEXING !== 'true') {
    return []
  }

  // Derive the site URL from the actual request so sitemap URLs match the host
  // a crawler is hitting (falling back to the configured URL).
  const requestHeaders = await headers()
  const proto = requestHeaders.get('x-forwarded-proto') ?? 'http'
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const baseUrl = host ? `${proto}://${host}` : app_url

  // Get all posts
  const allPosts = []
  let page = 1
  const limit = 100
  
  while (true) {
    const result = await getPostsWithReactions({ page, limit })
    allPosts.push(...result.items)
    if (!result.hasMore) break
    page++
  }

  const postEntries: MetadataRoute.Sitemap = allPosts.map((post) => ({
    url: `${baseUrl}/posts/${post.id}`,
    lastModified: post.updatedAt || post.createdAt || new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    // The about page joins the sitemap only when it is enabled in
    // about.config.yml (global indexing is already checked above).
    ...(isResumeEnabled()
      ? [
          {
            url: `${baseUrl}/about`,
            lastModified: new Date(),
            changeFrequency: 'monthly' as const,
            priority: 0.6,
          },
        ]
      : []),
    ...postEntries,
  ]
}
