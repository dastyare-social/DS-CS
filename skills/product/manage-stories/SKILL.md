---
name: manage-stories
description: Create, list, view, like, update and delete ephemeral stories on a DS-CS channel over REST or MCP. Use for 24-hour content, vertical video or image stories, story counters, or cleaning up expired story ids. For feed posts use post-with-media; for realtime notifications use webhooks.
---

# Working with stories

## How stories differ from posts

Stories are **ephemeral** — short-lived, single-media, portrait-first. They have no `content` field, no pin, and no reactions; they have `views` and `likes` counters instead. Everything else — auth, media upload, the API-key rate limit — is identical to posts.

```
Auth:      Authorization: Bearer <API_KEY>     (writes only; reads are public)
Media:     upload first, then reference the returned URL by media type
```

## Upload the media first

Stories only accept `image` and `video`. Use the same upload endpoints as posts:

```bash
curl -X POST https://cs.example.com/api/upload \
  -H "Authorization: Bearer $API_KEY" \
  -F "file=@clip.mp4"
```

Video limit is 100 MB; image limit is 10 MB. Stories are portrait-first — 1080×1920 is the intended shape, and it is what the story viewer lays out for.

## Create

```bash
curl -X POST https://cs.example.com/api/stories \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "video",
    "media": {
      "url": "https://…/media/video/abc.mp4",
      "width": 1080,
      "height": 1920,
      "duration": 18
    }
  }'
```

`type` is `image` or `video`. `media` accepts **either** a single object or an array — an array creates **one story per item** and returns the first, so if you post three clips you get three stories and must list to find the other two.

You can also set counters at creation time, which is useful when backfilling or seeding:

```json
{ "type": "image", "media": { "url": "…" }, "views": 120, "likes": 9 }
```

## Read

```bash
GET /api/stories?page=1&limit=20
GET /api/stories?type=count          # { "total": n }
GET /api/stories?kind=image          # filter by media kind
GET /api/stories?kind=video
GET /api/stories?search=keyword
GET /api/stories/{story_id}
```

Note the asymmetry: the **count** parameter is `type=count`, but the **media filter** is `kind=image` / `kind=video`. Using `type=image` for the filter does nothing.

## Views and likes

```bash
# increment
curl -X POST "https://cs.example.com/api/stories/$ID?action=view"

# like
curl -X POST "https://cs.example.com/api/stories/$ID?action=like&direction=inc"
curl -X POST "https://cs.example.com/api/stories/$ID?action=like&direction=dec"
```

`action=view` is public — it is what the player fires. `direction` is `inc` or `dec`; there is no toggle, so a double-tap from a client that sends `inc` twice over-counts. If you are wiring a reaction UI, read the current `likes` first and send the direction that moves it the way you want.

## Update

```bash
curl -X PATCH https://cs.example.com/api/stories/$ID \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"views": 500, "media": {"url": "https://…/new.mp4", "width":1080, "height":1920}}'
```

Partial update over `type`, `views`, `likes`, `media`.

## Delete

```bash
curl -X DELETE https://cs.example.com/api/stories/$ID \
  -H "Authorization: Bearer $API_KEY"
```

Permanent.

## Via MCP

| Tool | Auth | Purpose |
|---|---|---|
| `list_stories` | public | Paginated, searchable |
| `get_story` | public | One story |
| `count_stories` | public | Total |
| `create_story` | API key | Create from a media URL |
| `update_story` | API key | Media, views, likes |
| `delete_story` | API key | Remove |

`ds-cs mcp` prints ready-to-paste config for every major client.

## Mistakes that cost time

- Filtering with `type=image` instead of `kind=image` and getting the full list back.
- Posting an array and assuming one story was created — you created one per item.
- Sending `action=like` with no `direction`. It is `inc` or `dec`, never a toggle.
- Attaching an image URL to a story without uploading it first.
- Expecting a `content` caption field. Stories do not have one.
