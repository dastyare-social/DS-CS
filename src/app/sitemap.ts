import type { MetadataRoute } from 'next'
import { app_url } from '@/config/app'
import { getPostsWithReactions } from '@/lib/api/posts/queries'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
    ...postEntries,
  ]
}