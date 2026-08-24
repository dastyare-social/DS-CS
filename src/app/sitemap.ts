import type { MetadataRoute } from 'next'
import { app_url } from '@/config/app'
import { is_resume_enabled } from '@/config/resume'
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
    url: `${app_url}/posts/${post.id}`,
    lastModified: post.updatedAt || post.createdAt || new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [
    {
      url: app_url,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    // The resume page joins the sitemap only when it is enabled in
    // resume.config.yml (global indexing is already checked above).
    ...(is_resume_enabled
      ? [
          {
            url: `${app_url}/resume`,
            lastModified: new Date(),
            changeFrequency: 'monthly' as const,
            priority: 0.6,
          },
        ]
      : []),
    ...postEntries,
  ]
}
