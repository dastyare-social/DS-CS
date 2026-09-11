import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// The runtime indexing header is served by the proxy layer because
// next.config.ts bakes a noindex header into the build. This file ships as
// its own bundle, so the flag is evaluated at request time rather than being
// inlined during `next build`, which lets indexing be flipped without a
// rebuild.
export function proxy(_request: NextRequest) {
  // When indexing is globally disabled, pass through so the build-time
  // noindex header (and robots.txt) keep the site out of search results.
  if (process.env.NEXT_PUBLIC_ALLOW_INDEXING !== 'true') {
    return NextResponse.next()
  }

  // Override the build-time noindex header so crawlers may index the site.
  const response = NextResponse.next()
  response.headers.set('X-Robots-Tag', 'index, follow')
  return response
}

export const config = {
  matcher: [
    // Match pages only, skipping assets and routes that robots.txt already
    // steers crawlers away from (`/os/`, `/api/`, `/docs`, `/agents.md`).
    // The `posts` detail pages stay matched so they receive the header.
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|os|docs|agents\\.md|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|mjs|woff2?|ttf|eot|map)$).*)',
  ],
}