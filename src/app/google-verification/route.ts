import { NextResponse } from 'next/server'

export async function GET() {
  const ENABLE = process.env.NEXT_PUBLIC_ENABLE_SEARCH_CONSOLE === 'true'
  if (!ENABLE) return new NextResponse('Not found', { status: 404 })

  const envFilename = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_FILE || process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_FILENAME
  const token = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_TOKEN

  const expectedFilename = envFilename || (token ? `google${token}.html` : undefined)
  if (!expectedFilename) return new NextResponse('Not found', { status: 404 })

  const fileContent = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_FILE_CONTENT || (token ? `<html><head><meta name="google-site-verification" content="${token}" /></head><body>google-site-verification: ${expectedFilename}</body></html>` : '')

  return new NextResponse(fileContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}