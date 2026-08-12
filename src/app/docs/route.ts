import { ApiReference } from '@scalar/nextjs-api-reference'
import { app_url } from '@/config/app'

const config = {
  url: "/openapi.json",
  theme: 'mars' as const,
  defaultOpenAllTags: true,
  hideModels: true,
  hideDarkModeToggle: true,
  darkMode: false,
  expandAllModelSections: true,
  expandAllResponses: true,
  persistAuth: false,
  pathRouting: {
    basePath: "/docs",
  },
  mcp: {
    name: "dastyare-social",
    url: `${app_url}/api/mcp`,
  },
} as const

export const GET = ApiReference(config)
