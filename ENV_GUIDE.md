# Environment Variables Guide

This document describes every environment variable used by the Dastyare Social CS app.
The reference file is `.env.example` — copy it to `.env` (or your hosting provider's env
config) and fill in real values.

## Conventions

- `NEXT_PUBLIC_*` variables are bundled into the client at build time. They are **not**
  secret and may appear in the browser.
- The remaining (non `NEXT_PUBLIC_`) variables are server-side only. Keep them secret —
  they never ship to the client bundle.

---

## Database

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string. `postgresql://user:password@host:5432/db` |

Used by Drizzle ORM for all persistence.

---

## Admin bootstrap

Used by `bun run setup` / the bootstrap script to create or update the admin user.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `ADMIN_EMAIL` | ✅ | `admin@example.com` | Email of the admin account created by the bootstrap script. |
| `ADMIN_PASSWORD` | ✅ | `change-this-strong-password` | Password for the admin account. Use a strong value. |

---

## API keys & rate limiting

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `API_KEY` | ✅ | — | Shared bearer key for protected API routes. Sent as `Authorization: Bearer <key>`. Generate with `openssl rand -hex 32`. |
| `API_KEY_RATE_LIMIT_MAX_REQUESTS` | — | `30` | Max requests allowed per window for API clients. |
| `API_KEY_RATE_LIMIT_WINDOW_MS` | — | `60000` | Rate-limit window in milliseconds. |
| `MCP_API_KEY` | — | *(falls back to `API_KEY`)* | Optional separate key that enables write tools on the standalone (stdio) MCP server. |

---

## Auth (Better Auth)

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `BETTER_AUTH_URL` | ✅ | — | The app's public URL. |
| `BETTER_AUTH_SECRET` | ✅ | — | Long random secret used to sign sessions/JWT. Generate with `openssl rand -base64 32`. |

> `BETTER_AUTH_SECRET` is consumed by the better-auth library directly (not referenced by
> name in `src/`); it is required for signing. `scripts/install.sh` can generate one.

---

## Media storage (S3)

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `S3_ENDPOINT` | ✅ | — | S3-compatible endpoint. Example for Supabase storage, MinIO/R2, or AWS S3. |
| `S3_REGION` | — | `us-east-1` | Region of the bucket. |
| `S3_ACCESS_KEY_ID` | ✅ | — | Access key for the bucket. |
| `S3_SECRET_ACCESS_KEY` | ✅ | — | Secret key for the bucket. |
| `S3_BUCKET_NAME` | ✅ | `dastyare-social-cs` | Bucket name. |
| `S3_FORCE_PATH_STYLE` | — | `true` | Whether to force path-style addressing (required for some providers like MinIO). |
| `S3_PUBLIC_BASE_URL` | ✅ | — | Public URL base for serving files (differs from `S3_ENDPOINT` for some providers). |

Public URL examples:
- Supabase: `https://your-project.supabase.co/storage/v1/object/public`
- MinIO/R2: `https://your-domain.com`
- AWS S3: `https://your-bucket.s3.amazonaws.com`

---

## Media limits & validation

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `MEDIA_MAX_IMAGE_SIZE_MB` | — | `10` | Max image upload size in MB. |
| `MEDIA_MAX_VIDEO_SIZE_MB` | — | `100` | Max video upload size in MB. |
| `MEDIA_MAX_AUDIO_SIZE_MB` | — | `25` | Max audio upload size in MB. |
| `MEDIA_MAX_FILE_SIZE_MB` | — | `25` | Max generic file upload size in MB. |
| `MEDIA_ALLOWED_MIME_TYPES` | — | *(built-in allowlist)* | Optional comma-separated MIME allowlist override, e.g. `image/jpeg,image/png,video/mp4`. Empty = built-in allowlist. |
| `MEDIA_KEY_PREFIX` | — | `media` | Storage key prefix for uploaded media. |

---

## UI / feature toggles

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_ANIMATED_EMOJIES` | — | `false` | Enable animated emojis. |
| `NEXT_PUBLIC_SHOW_INTERNAL_NAV` | — | `false` | Show internal nav links. Set `true` for admin previews. |
| `DEMO_MODE` | — | `false` | Server-only demo mode. When `true`, create/update/delete are disabled everywhere (posts, stories, media uploads). Reads, views, likes and reactions keep working. |

---

## URL shortener (Dastyare Social SH)

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DS_SH_URL` | — | *(empty)* | Local URL shortener instance base URL. Empty = skip shortening (falls back to original URLs). |
| `DS_SH_API_KEY` | — | *(empty)* | API key for the shortener service. |

Push notifications shorten links via this service when configured.

---

## Analytics (PostHog)

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | ✅ | — | Public project token (Dastyare Social ORG project 581705). |
| `NEXT_PUBLIC_POSTHOG_HOST` | — | `https://us.i.posthog.com` | PostHog host, shared by the browser and the server. |
| `DISABLE_DEV_TEAM_PH` | — | `true` | Relay server events to the Cloudflare reverse proxy (ingest.dastyare.social). Default `true` = on/send. Set `false` to stop sending. |

### PostHog bootstrap (script only)

Used only by `bun run bootstrap:posthog` to provision dashboards/folders/insights.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PH_PROJECT_ID` | — | `581705` | Project ID; auto-discovered from the key if unset. |
| `PH_PERSONAL_API_KEY` | ✅ | — | `phx_` personal API key with admin scope, used by the bootstrap script only. |

---

## App URL & Web Push

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | — | `http://localhost:8729` | Public URL used for SEO/metadata and client config. |
| `NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY` | — | *(empty)* | VAPID public key for web push notifications. |
| `WEBPUSH_PRIVATE_KEY` | — | *(empty)* | VAPID private key for web push notifications (server-side, secret). |
| `WEBPUSH_SUBJECT` | — | `mailto:you@example.com` | Web Push subject (contact email). |

---

## SEO / Search Console

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_ENABLE_SEARCH_CONSOLE` | — | `false` | Set `true` to enable meta/file verification helpers. |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | — | *(empty)* | Google site verification token (when using the token approach). |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_FILE` | — | *(empty)* | Google site verification filename (when using the file approach). |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_FILE_CONTENT` | — | *(empty)* | Optional exact HTML file content Google provided. |
| `NEXT_PUBLIC_ALLOW_INDEXING` | — | `false` | Control indexing globally. Set `true` in production when ready for search engines to index. |
| `NEXT_PUBLIC_ADDITIONAL_IMAGE_DOMAINS` | — | *(empty)* | Comma-separated additional domains for Next.js Image optimization. Example: `example.com,cdn.example.com,https://storage.example.com` |
