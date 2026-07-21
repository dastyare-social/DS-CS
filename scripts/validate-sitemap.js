const fs = require('fs')
const path = require('path')

const sitemapPath = path.join(__dirname, '..', 'src', 'app', 'sitemap.ts')
// These patterns are checked only inside template-literal URL strings (backtick expressions),
// so import paths like '@/lib/api/...' are not false-positives.
const blockedRoutes = ['/os/', '/api/', '/agents.md', '/docs/']
const requiredPatterns = [
  {
    description: 'generate the sitemap dynamically',
    pattern: /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/, 
  },
  {
    description: 'include the application home page',
    pattern: /url:\s*app_url/,
  },
  {
    description: 'include public post URLs',
    pattern: /\/posts\/\$\{post\.id\}/,
  },
]

function run() {
  if (!fs.existsSync(sitemapPath)) {
    console.error('Dynamic sitemap source not found at', sitemapPath)
    process.exit(1)
  }

  const sitemap = fs.readFileSync(sitemapPath, 'utf8')
  const missing = requiredPatterns.filter(({ pattern }) => !pattern.test(sitemap))
  // Extract only the URL strings from template literals (e.g. `${app_url}/posts/...`)
  // to avoid false positives from import paths like '@/lib/api/posts/queries'.
  const urlStrings = [...sitemap.matchAll(/`[^`]*`/g)].map(m => m[0]).join('\n')
  const blocked = blockedRoutes.filter(route => urlStrings.includes(route))

  if (missing.length > 0) {
    console.error('Sitemap is missing required public routes:')
    missing.forEach(({ description }) => console.error(` - Must ${description}.`))
    process.exit(2)
  }

  if (blocked.length > 0) {
    console.error('Sitemap contains blocked/internal URLs:')
    blocked.forEach(route => console.error(` - ${route}`))
    process.exit(3)
  }

  console.log('Dynamic sitemap validation passed.')
}

run()
