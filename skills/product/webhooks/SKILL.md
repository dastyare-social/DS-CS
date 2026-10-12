---
name: webhooks
description: Register, inspect and verify signed webhook deliveries from a DS-CS channel. Use for reacting to post and story events, debugging a failing endpoint, or verifying the x-ds-webhook-signature HMAC. For posting content use post-with-media.
---

# Webhooks

## What it is for

A channel POSTs a signed JSON body to a URL you register whenever something happens. Use it to mirror content into a newsletter, a Discord channel, a cache, or another service — anything that should react to activity without polling.

## Register an endpoint

```bash
curl -X POST https://cs.example.com/api/webhooks \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://my-app.com/hooks/ds-cs",
    "events": ["post.created", "post.updated", "post.deleted"]
  }'
```

The response contains a **per-endpoint HMAC secret, returned only once**. Store it immediately — it cannot be read back in plaintext later.

```json
{
  "id": "…",
  "url": "https://my-app.com/hooks/ds-cs",
  "events": ["post.created"],
  "secret": "whsec_…"
}
```

## Events

| Group | Events |
|---|---|
| Posts | `post.created`, `post.updated`, `post.deleted`, `post.reacted`, `post.viewed` |
| Stories | `story.created`, `story.updated`, `story.deleted`, `story.viewed`, `story.liked` |

Subscribe only to what you use — every event is a delivery, and each one is an outbound HTTP request from your channel.

## Delivery payload

```json
{
  "id": "<delivery id>",
  "event": "post.created",
  "timestamp": "2026-08-23T10:15:00.000Z",
  "data": { "…": "the post or story record" }
}
```

`data` carries the affected record. Verify the signature **before** parsing it.

## Verify the signature — do not skip this

Every delivery has:

```
x-ds-webhook-signature: t=<unix>,v1=<hex>
```

`t` is a unix timestamp, `v1` is a lowercase hex HMAC-SHA256. The signed message is the timestamp, a dot, and the **raw request body** — not the parsed JSON:

```js
import { createHmac, timingSafeEqual } from "node:crypto";

export async function POST(request) {
  const header = request.headers.get("x-ds-webhook-signature") ?? "";
  const match = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header);
  if (!match) return new Response("bad signature header", { status: 401 });

  const [, timestamp, provided] = match;

  // Reject replays: anything older than five minutes is not a fresh delivery.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) return new Response("stale delivery", { status: 401 });

  // The raw body — read as text BEFORE any JSON.parse.
  const raw = await request.text();

  const expected = createHmac("sha256", process.env.DS_CS_WEBHOOK_SECRET)
    .update(`${timestamp}.${raw}`)
    .digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new Response("invalid signature", { status: 401 });
  }

  const payload = JSON.parse(raw);
  // … handle it
  return new Response("ok", { status: 200 });
}
```

Four things that break naive verification:

1. **Sign the raw body.** Re-serializing with `JSON.stringify` changes key order and whitespace, so the HMAC will not match.
2. **Use the raw request body**, not a framework-parsed object. In Next.js, call `await request.text()` — once. Calling `request.json()` first consumes the stream.
3. **Compare with `timingSafeEqual`.** A plain `===` leaks the signature byte by byte.
4. **Check the timestamp.** Without a freshness check, a captured delivery can be replayed forever.

The secret is **per endpoint**, not the channel `API_KEY`. The two are unrelated and never interchangeable.

## Retries and delivery status

Failed deliveries are retried up to three times with backoff. The final failure is recorded.

```bash
GET /api/webhooks                  # list, with lastStatus / lastAttemptAt / failureCount
GET /api/webhooks/{webhook_id}     # one endpoint, with delivery status
```

`failureCount` climbing is the signal to check: is your endpoint returning 2xx fast, or timing out?

## Manage

```bash
# change URL, events, or pause
curl -X PATCH https://cs.example.com/api/webhooks/$ID \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"events":["post.created","story.created"],"active":true}'

# pause without deleting
curl -X PATCH https://cs.example.com/api/webhooks/$ID \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"active":false}'

# delete permanently
curl -X DELETE https://cs.example.com/api/webhooks/$ID \
  -H "Authorization: Bearer $API_KEY"
```

Pausing (`active: false`) stops deliveries but keeps the endpoint and its secret. Deleting removes it and the secret with it.

## Verify locally before going live

```bash
ngrok http 3000     # or any tunnel
# register the https URL
curl -X POST https://cs.example.com/api/webhooks/$ID \
  -H "Authorization: Bearer $API_KEY" -d '{"events":["post.created"]}'
# then create a post and watch the tunnel log
```

Confirm your handler returns 2xx quickly. Slow handlers exhaust the retry budget.

## Mistakes that cost time

- Verifying against the channel `API_KEY` instead of the endpoint secret.
- `JSON.parse` before `request.text()`, leaving nothing to verify.
- Skipping the timestamp check and leaving the endpoint replayable.
- Registering `*.*` and drowning in `post.viewed` deliveries.
- Treating a 4xx as retryable noise. A 4xx means your handler rejected the event; it will not succeed on retry. Return 2xx for anything you have durably queued, and process asynchronously.
