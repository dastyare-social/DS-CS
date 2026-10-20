---
name: list-analytics
description: Fetch per-post and per-account engagement analytics (impressions, reach, likes, comments, views, follower counts) from the Zernio analytics API.
---

# Skill: Fetch analytics for posts and accounts

Pull engagement metrics for a published post or aggregate analytics for a connected social account.

## When to use
The user wants reach, impressions, likes, comments, saves, views, or follower counts for their Zernio-managed content.

## Per-post analytics
`GET https://zernio.com/api/v1/analytics/post/{postId}` with `Authorization: Bearer YOUR_API_KEY`.

Returns per-platform metrics keyed by platform name. Metrics available vary by platform (Instagram exposes saves, TikTok exposes video_views, etc.). See the OpenAPI spec for the exact schema.

## Account-level analytics
`GET https://zernio.com/api/v1/analytics/social/{accountId}?range=30d`: returns daily time-series follower counts and per-day aggregate engagement.

## Freshness
Platform APIs cache metrics; expect up to 24h lag for some platforms (YouTube, LinkedIn). Instagram and X update within minutes.

## Docs
- Analytics reference: https://docs.zernio.com/core/analytics
- OpenAPI spec: https://zernio.com/openapi.yaml
