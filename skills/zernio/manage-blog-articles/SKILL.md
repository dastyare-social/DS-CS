---
name: manage-blog-articles
description: Create, read, update, schedule, and delete blog articles on connected WordPress and Shopify sites through the Zernio Blogs API.
---

# Skill: Manage blog articles

Create, read, update, schedule, or delete standard articles on a connected WordPress, Shopify, or Wix site through Zernio.

## When to use
The user wants API-driven blog publishing. WordPress supports WordPress.com OAuth and self-hosted sites. A blog connection is separate from social publishing and does not provide Inbox, ads, or social analytics.

## Prerequisites
1. A Zernio API key (Bearer token).
2. A connected WordPress, Shopify, or Wix account. List accounts with `GET /api/v1/accounts`.
3. A blog id from `GET /api/v1/accounts/{accountId}/blogs`. Each WordPress site exposes one blog: WordPress.com uses the selected site's numeric ID; self-hosted WordPress and Wix use `1`. Always use the returned blog id.

## Connect WordPress

WordPress.com:
`GET https://zernio.com/api/v1/connect/wordpress?profileId=PROFILE_ID&redirect_url=CALLBACK_URL`

Self-hosted WordPress:
`POST https://zernio.com/api/v1/connect/wordpress/token`

```json
{
  "profileId": "PROFILE_ID",
  "siteUrl": "https://blog.example.com",
  "username": "editor",
  "applicationPassword": "xxxx xxxx xxxx xxxx xxxx xxxx"
}
```

Use a WordPress Application Password, not the user's login password. The self-hosted site must use HTTPS, and the user must be able to publish posts and upload media.

## Connect Wix

`GET https://zernio.com/api/v1/connect/wix?profileId=PROFILE_ID&redirect_url=CALLBACK_URL`

Send the user to the returned `authUrl`: it installs the Zernio app on their Wix site, which needs the Wix Blog app.

## Create an article

`POST https://zernio.com/api/v1/accounts/{accountId}/blogs/{blogId}/articles`

```json
{
  "title": "Autumn collection preview",
  "bodyHtml": "<p>The first pieces land next month.</p>",
  "handle": "autumn-collection-preview",
  "excerpt": "A preview of the new collection.",
  "tags": ["autumn", "news"],
  "image": {
    "url": "https://cdn.example.com/autumn.jpg",
    "altText": "Autumn collection"
  },
  "isPublished": true,
  "publishDate": "2026-10-01T09:00:00.000Z"
}
```

Set `isPublished` to `false` for a draft. A future `publishDate` uses the provider's native scheduler. On self-hosted WordPress, exact publication timing depends on the site's cron configuration.

## Other article operations

- List: `GET /api/v1/accounts/{accountId}/blogs/{blogId}/articles`
- Get: `GET /api/v1/accounts/{accountId}/blogs/{blogId}/articles/{articleId}`
- Update: `PATCH /api/v1/accounts/{accountId}/blogs/{blogId}/articles/{articleId}`
- Delete: `DELETE /api/v1/accounts/{accountId}/blogs/{blogId}/articles/{articleId}`

## WordPress limits

Site/blog creation, renaming, and deletion are not supported. SEO plugin fields, custom post types, and a visual blog editor are also unsupported. Invalid unsupported fields return a validation error.

## Wix limits

Lists return `bodyHtml: null` (get the article for its body). `author` is a Wix site member id. Each HTML block must fit Wix's 30,000-character conversion limit.

## Docs

- WordPress: https://docs.zernio.com/platforms/wordpress
- OpenAPI spec: https://zernio.com/openapi.yaml
