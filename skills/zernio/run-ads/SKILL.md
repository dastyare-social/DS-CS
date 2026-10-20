---
name: run-ads
description: Create, pause, and inspect paid ad campaigns on Meta, Google, TikTok, LinkedIn, Pinterest, X, OpenAI Ads, and Reddit Ads via the unified /v1/ads API.
---

# Skill: Create and manage paid ads

Create ad campaigns on Meta, Google, TikTok, LinkedIn, Pinterest, X, OpenAI Ads, or Reddit Ads through Zernio's unified ads API.

## When to use
The user wants to launch, pause, or inspect paid campaigns across ad networks without integrating each network's own API, or to promote a post that performed well organically.

## Prerequisites
1. A Zernio API key (Bearer token) on an account with the Ads add-on.
2. A connected ads account (e.g. `metaads`, `googleads`, `redditads`). List them with `GET /api/v1/accounts` and check `GET /api/v1/ads/accounts` for ad-capable ones.

## Create an ad
`POST https://zernio.com/api/v1/ads/create`

Headers:
- `Authorization: Bearer YOUR_API_KEY`
- `Content-Type: application/json`

Body (minimal Meta example):
```json
{
  "accountId": "ADS_ACCOUNT_ID",
  "name": "Spring launch",
  "objective": "OUTCOME_TRAFFIC",
  "dailyBudget": 2000,
  "creative": {
    "text": "Try the new collection",
    "mediaUrls": ["https://example.com/ad.jpg"],
    "linkUrl": "https://example.com/shop"
  }
}
```

Budgets are integer cents in the ad account's own currency.

## Manage
- `GET /api/v1/ads` lists ads with status and spend; `GET /api/v1/ads/{id}` for one.
- `POST /api/v1/ads/{id}/status` with `{"status":"PAUSED"}` (or `"ACTIVE"`) pauses or resumes; child ad sets and ads follow the parent switch.
- `GET /api/v1/ads/{id}/insights` returns impressions, clicks, spend, and conversions.

## Common errors
- `403 ads_addon_required`: the account has no Ads add-on; upgrade in the dashboard.
- Platform validation errors are returned verbatim under `platformError` with a mapped `code`; fix the named field and retry.
- `429`: back off per `Retry-After`.

## Reference
- Ads API docs: https://docs.zernio.com/ads
- Webhook `ad.status_changed` fires when the network changes an ad's status.
