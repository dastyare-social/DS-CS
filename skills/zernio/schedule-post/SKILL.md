---
name: schedule-post
description: Schedule or immediately publish a social media post to one or more connected accounts via the Zernio REST API.
---

# Skill: Schedule a social media post

Schedule a post across one or more connected social accounts on Zernio.

## When to use
The user wants to publish text, images, or video to Instagram, TikTok, YouTube, X/Twitter, LinkedIn, Facebook, Threads, Pinterest, Bluesky, WhatsApp, Telegram, Discord, Snapchat, or Google Business, either immediately or at a future time. Reddit is temporarily unavailable: Reddit has blocked third-party apps from its API, so new Reddit connections and Reddit posts return 503 `PLATFORM_DISABLED` until Reddit restores access.

## Prerequisites
1. A Zernio API key (Bearer token). Get one at https://zernio.com/dashboard after signing up.
2. At least one social account connected to a profile. List accounts with `GET /api/v1/accounts`.

## Request
`POST https://zernio.com/api/v1/posts`

Headers:
- `Authorization: Bearer YOUR_API_KEY`
- `Content-Type: application/json`

Body:
```json
{
  "content": "Launching today.",
  "platforms": [
    { "platform": "instagram", "accountId": "ACCOUNT_ID" },
    { "platform": "twitter", "accountId": "ACCOUNT_ID" }
  ],
  "mediaItems": [{ "type": "image", "url": "https://example.com/image.jpg" }],
  "scheduledFor": "2026-05-01T15:00:00.000Z"
}
```

Omit `scheduledFor` to publish immediately.

## Response
`201 Created` with the persisted post document including `_id` and per-platform publish status.

## Common errors
- `401`: missing or invalid API key.
- `400 platform_not_connected`: the account isn't linked to the referenced profile.
- `429 rate_limited`: platform or Zernio-side rate limit hit; retry after the header-indicated delay.

## Docs
- API reference: https://docs.zernio.com/core/posts/create-post
- OpenAPI spec: https://zernio.com/openapi.yaml
