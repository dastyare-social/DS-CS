---
name: connect-account
description: Connect a social platform account (Instagram, TikTok, YouTube, X, LinkedIn, Facebook, Threads, Pinterest, Bluesky, WhatsApp, Telegram, Discord, Snapchat, Google Business) to a Zernio profile via OAuth.
---

# Skill: Connect a social media account

Connect a user's Instagram, TikTok, YouTube, X, LinkedIn, Facebook, Threads, Pinterest, Bluesky, WhatsApp, Telegram, Discord, Snapchat, or Google Business account to a Zernio profile. Reddit is temporarily unavailable: Reddit has blocked third-party apps from its API, so new Reddit connections and Reddit posts return 503 `PLATFORM_DISABLED` until Reddit restores access.

## When to use
Before posts can be scheduled, a user must OAuth-link their social account to a Zernio profile.

## Flow
1. Create or select a profile: `POST /api/v1/profiles` or `GET /api/v1/profiles`.
2. Generate a connect URL: `POST /api/v1/accounts/connect` with `{ "platform": "instagram", "profileId": "PROFILE_ID" }`. The response contains a short-lived `connectUrl`.
3. Redirect the end user to `connectUrl`. They complete OAuth on the platform.
4. Zernio finalizes the connection and the account appears in `GET /api/v1/accounts?profileId=PROFILE_ID`.

## Headless / server-to-server
For headless OAuth (no browser redirect), pass `X-Connect-Token` with a one-time token issued by the connect endpoint. See the OAuth section of the docs for platform-specific scopes and caveats (Instagram requires Business/Creator accounts; YouTube requires a verified channel).

## Docs
- Connect accounts: https://docs.zernio.com/core/accounts/connect
- Platform-specific notes: https://docs.zernio.com/platforms
