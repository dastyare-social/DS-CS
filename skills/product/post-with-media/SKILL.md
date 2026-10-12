---
name: post-with-media
description: Create, read, edit, pin and delete posts on a live DS-CS channel over the REST API — including the two-step media upload and the exact request shapes. Use when an agent needs to publish content, list or search existing posts, pin a post, or clean one up. For stories use manage-stories; for realtime delivery use webhooks.
---

# Working with posts

## Connection

```
Base URL:  https://<your-channel>
Auth:      Authorization: Bearer <API_KEY>     (write operations only)
```

The API key is the `API_KEY` from the channel's `.env` (`openssl rand -hex 32` to generate one). **Reads are public — no key needed.** Writes (POST, PATCH, DELETE) require it, and are rate limited per IP and path (`API_KEY_RATE_LIMIT_MAX_REQUESTS`, default 30 per `API_KEY_RATE_LIMIT_WINDOW_MS`, default 60s).

Set it up once:

```bash
ds-cs login --url https://cs.example.com --api-key "$API_KEY"
```

## Upload media first — always

A post references media **by URL**. There is no inline base64 body. Upload, then reference the returned `url`.

**Server-side (curl, agents, MCP — simplest):**

```bash
curl -X POST https://cs.example.com/api/upload \
  -H "Authorization: Bearer $API_KEY" \
  -F "file=@photo.jpg"
```

Returns:

```json
{
  "url": "https://…/media/image/9f8e….jpg",
  "key": "media/image/9f8e….jpg",
  "kind": "image",
  "mimeType": "image/jpeg",
  "size": 1234567,
  "width": 1080,
  "height": 1920,
  "duration": 0,
  "filename": "photo.jpg"
}
```

**Direct browser-to-S3 (real upload progress):** `POST /api/upload/presign` with `{ filename, mimeType }` → `PUT` the file to the returned `uploadUrl` → `POST /api/upload/confirm` with `{ key, mimeType, filename, size, width, height, duration }` → the full media object. Prefer presign for large videos; the single-file endpoint buffers the whole thing in memory on the server.

### Constraints

| Kind | Max size | Allowed MIME |
|---|---|---|
| image | 10 MB | jpeg, png, webp, gif, avif, svg+xml |
| video | 100 MB | mp4, webm, quicktime |
| audio | 25 MB | mpeg, mp4, wav, ogg, aac, flac |
| file | 25 MB | pdf, text/plain |

Override with `MEDIA_MAX_IMAGE_SIZE_MB`, `MEDIA_MAX_VIDEO_SIZE_MB`, `MEDIA_MAX_AUDIO_SIZE_MB`, `MEDIA_MAX_FILE_SIZE_MB`, `MEDIA_ALLOWED_MIME_TYPES`. Validation failures come back as `MediaValidationError` with a specific message and status.

## Create a text post

```bash
curl -X POST https://cs.example.com/api/posts \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content":"Just shipped a new feature!"}'
```

Returns `201` with the created post.

## Create a media post

```bash
curl -X POST https://cs.example.com/api/posts \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Studio clip",
    "media": [
      {
        "url": "https://…/media/video/abc.mp4",
        "type": "video",
        "width": 1080,
        "height": 1920,
        "duration": 42
      }
    ]
  }'
```

`type` is one of `text`, `image`, `video`, `voice`, `file`. `width`/`height` matter — the feed classifies a video as a **short** by aspect ratio (9:16, filtered to 1.6–2.0), so a vertical video with no dimensions is never treated as a short.

**Multiple media items create one post per item**, except when every item is an image, which produces a single carousel post. The response is the first post; use `list_posts` to find the others.

## Read posts

```bash
GET /api/posts?page=1&limit=20            # paginated
GET /api/posts?type=count                 # { "total": n }
GET /api/posts?type=shorts                # vertical videos only
GET /api/posts?search=photography         # free-text
GET /api/posts/{post_id}                  # one post, with reactions
```

`limit` is capped at 100. List response shape:

```json
{
  "items": [
    {
      "id": "b1a2c3d4-…",
      "type": "list",
      "content": "…",
      "media": [{ "kind": "image", "url": "…", "width": 1080, "height": 1920 }],
      "reactions": [{ "emoji": "❤️", "count": 12 }],
      "views": 342,
      "pinnedAt": null,
      "postStatus": "sent",
      "createdAt": "2026-08-23T10:15:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1,
  "hasMore": false
}
```

`views` is a display counter stored as a string — treat it as opaque and do not parse it as a number.

## Edit and pin

```bash
curl -X PATCH https://cs.example.com/api/posts/$POST_ID \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pinnedAt":"2026-08-21T00:00:00Z"}'
```

Partial update. Any of `content`, `views`, `pinnedAt`, `media`, `type`. Passing `pinnedAt: null` unpins. Pinned posts surface in a dedicated bar and at the top of the feed.

## React and view

```bash
curl -X POST https://cs.example.com/api/posts/$POST_ID?action=reaction \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{"emoji":"🔥"}'

curl -X POST https://cs.example.com/api/posts/$POST_ID?action=view
```

`action=view` increments the counter and is public.

## Delete

```bash
curl -X DELETE https://cs.example.com/api/posts/$POST_ID \
  -H "Authorization: Bearer $API_KEY"
```

Permanent. There is no trash and no undo.

## Via MCP instead

If an MCP client is connected, prefer the typed tools — the server enforces auth and the schemas for you:

| Tool | Auth | Purpose |
|---|---|---|
| `list_posts` | public | Paginated, searchable |
| `get_post` | public | One post with reactions |
| `create_post` | API key | Text or media post |
| `update_post` | API key | Content / pin status |
| `delete_post` | API key | Remove a post |

Connect with `ds-cs mcp claude-code`, or point any client at `https://<channel>/api/mcp`.

## Verify

Discovery endpoint, useful for confirming a channel is alive:

```bash
curl https://cs.example.com/.well-known/mcp
```

Full REST reference is served at `https://cs.example.com/docs`, and the OpenAPI spec at `/openapi.json`.

## Mistakes that cost time

- Posting a URL that was never uploaded — the media silently renders broken.
- Omitting `width`/`height` on a vertical video and wondering why it is not a short.
- Expecting `update_post` to replace media — it is a partial patch; send the fields you mean to change.
- Deleting by a guessed ID. `list_posts` first, then delete the exact `id` that came back.
- Assuming reads need auth. They do not, and a 401 on a `GET` means your *key* is wrong, not that auth is required.
