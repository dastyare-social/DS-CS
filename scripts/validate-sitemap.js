const fs = require('fs')
const path = require('path')

const sitemapPath = path.join(__dirname, '..', 'public', 'sitemap.xml')
const blockedPatterns = [/^\/os\//, /^\/api\//, /^\/~offline$/, /^\/pwa-self-test$/, /^\/agents\.md$/, /^\/docs\//]

function run() {
  if (!fs.existsSync(sitemapPath)) {
    console.error('sitemap.xml not found at', sitemapPath)
    process.exit(1)
  }

  const sitemap = fs.readFileSync(sitemapPath, 'utf8')
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])

  const bad = []
  for (const url of urls) {
    try {
      const p = new URL(url).pathname
      for (const re of blockedPatterns) {
        if (re.test(p)) bad.push({ url, pattern: re.source })
      }
    } catch (e) {
      // skip
    }
  }

  if (bad.length > 0) {
    console.error('Sitemap contains blocked/internal URLs:')
    bad.forEach(b => console.error(` - ${b.url} matches ${b.pattern}`))
    process.exit(2)
  }

  console.log('Sitemap validation passed — no blocked routes found.')
}

run()
