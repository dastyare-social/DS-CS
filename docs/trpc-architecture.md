# tRPC Architecture (Pre-oRPC Migration)

Internal developer reference. Captures the tRPC layer exactly as it existed **before** the oRPC migration, so the before/after difference stays auditable and any behavior change can be traced to a decision.

> **Status:** Historical. This layer was replaced by oRPC.
> See [`orpc-architecture.md`](./orpc-architecture.md) for the current design, including the three traps found during the migration (relative-URL rejection, the required catch-all route segment, and the Service Worker's wire-format coupling).

---

## Purpose

tRPC served one narrow job: an **internal, typed RPC channel between the React client and the server** for the posts and stories features.

It was explicitly **not** a public API. `AGENTS.md` states tRPC should be "avoided for external integrations" — external and MCP consumers use the REST API under `/api` instead.

---

## Files involved

| File | Role |
|---|---|
| `src/lib/trpc/trpc.ts` | tRPC instance, `router`/`publicProcedure` exports, superjson transformer |
| `src/lib/trpc/router.ts` | The 18 procedures (11 posts + 7 stories) + Zod input schemas |
| `src/lib/trpc/client.ts` | Browser client — `createTRPCProxyClient` + `httpBatchLink` |
| `src/app/api/trpc/route.ts` | Route handler (flat path) |
| `src/app/api/trpc/[trpc]/route.ts` | Route handler (catch-all path) |
| `src/lib/actions/posts.ts` | **Only** consumer of `posts.*` — the frontend's action layer |
| `src/lib/actions/stories.ts` | **Only** consumer of `stories.*` — the frontend's action layer |

---

## Core architecture: three layers

```
React components  ("use client", 9 files)
        │  import { getPosts, deletePost, ... }
        ▼
Action layer      src/lib/actions/{posts,stories}.ts
        │  trpc.posts.list.query(...)      ← thin, 1:1 wrapper per procedure
        ▼
Transport         tRPC client → HTTP POST /api/trpc  (superjson-encoded)
        │  network round-trip (browser → server)
        ▼
Router            src/lib/trpc/router.ts   (validates input, calls business logic)
        │
        ▼
Business logic    src/lib/api/posts/*, src/lib/api/stories/*
```

### Key constraint: the client is always the browser

Every one of the 9 consumer files carries `"use client"`. The client uses a **relative** URL (`/api/trpc`), so every call is a real network round-trip — there is no in-process/direct-call fast path. Any replacement must preserve this: the action layer must keep working when bundled for the browser.

### Context is intentionally empty

```ts
export type Context = object;
export const createContext = (): Context => ({});
```

All 18 procedures are `publicProcedure`. **No auth, no session, no per-request context** is threaded through the tRPC layer. This is not an oversight to fix during migration — it is load-bearing context for how write endpoints are authorized elsewhere (REST layer + MCP).

---

## The 18 procedures

### `posts.*` (11)

| Procedure | Kind | Input | Business call |
|---|---|---|---|
| `posts.exploreInitial` | query | — | `getPostsWithReactions` ×2, filtered to 9:16 |
| `posts.list` | query | `postListInput` | `getPostsWithReactions` (+ optional shorts filter) |
| `posts.count` | query | — | `countPosts` |
| `posts.pinned` | query | — | `getPinnedPosts` |
| `posts.getById` | query | `postIdInput` | `getPostById` (throws if missing) |
| `posts.create` | mutation | `postCreateInput` | `createPost` |
| `posts.batchView` | mutation | `postBatchViewInput` | `batchIncrementViews` |
| `posts.addReaction` | mutation | `postReactionInput` | `addReaction` |
| `posts.view` | mutation | `postIdInput` | `viewPost` |
| `posts.delete` | mutation | `postIdInput` | `deletePostById` (throws if missing) |
| `posts.update` | mutation | `postUpdateInput` | `updatePost` (throws if missing) |

### `stories.*` (7)

| Procedure | Kind | Input | Business call |
|---|---|---|---|
| `stories.list` | query | `storyListInput` | `getStories` |
| `stories.count` | query | — | `countStories` |
| `stories.getById` | query | `storyIdInput` | `getStoryById` (throws if missing) |
| `stories.view` | mutation | `storyIdInput` | `incrementStoryViews` |
| `stories.like` | mutation | `storyLikeInput` | `toggleStoryLike` |
| `stories.create` | mutation | inline Zod | `createStory` |
| `stories.delete` | mutation | `storyIdInput` | `deleteStoryById` |

> `posts.pinned` is a **declared procedure but not part of the 9 consumer files' critical path** — it is reached via `getPinnedPosts()` in the action layer.

---

## Two things that must survive the migration

### 1. `Date` objects cross the wire

`PostWithReactions` (in `src/lib/api/posts/queries.ts`) is:

```ts
export type PostWithReactions = {
  ...
  createdAt: Date | null;
  updatedAt: Date | null;
}
```

These are **real `Date` instances**, not ISO strings. Plain `JSON.stringify` would turn them into strings and silently break every `toLocaleString()` / relative-time rendering in the UI.

tRPC solved this with the **superjson** transformer, configured in *two* places that must stay in sync:

- `src/lib/trpc/trpc.ts` → `initTRPC().create({ transformer: superjson })`
- `src/lib/trpc/client.ts` → `httpBatchLink({ transformer: superjson })`

Dropping superjson without a replacement is the single highest-risk part of this migration.

### 2. Error messages are readable

tRPC propagates the thrown `Error` message to the client. The router throws plain errors like `new Error("Post not found")`, and consumers can read `err.message`.

---

## Duplicate route handlers

Both of these exist and both work:

- `src/app/api/trpc/route.ts` — the flat path
- `src/app/api/trpc/[trpc]/route.ts` — the catch-all path

`[trpc]/route.ts` additionally clones the response and warns when a non-JSON body comes back — leftover debugging instrumentation, plus a `console.log` of every request. Both handlers are `force-dynamic` and wrap the adapter in a try/catch that returns a JSON 500.

---

## Unused dependencies

`@trpc/next` and `@trpc/react-query` were listed in `package.json` but **never imported anywhere** in `src/` or `scripts/`. Only `@trpc/client` and `@trpc/server` were actually used. There is no `TRPCProvider` anywhere — consumers are plain async functions, not React Query hooks.

---

## Test isolation

Every component test that touches these code paths mocks at the **action layer**, not the transport:

```ts
vi.mock('@/lib/actions/posts', () => ({ ... }))
vi.mock('@/lib/actions/stories', () => ({ ... }))
```

Consequence: the transport swap is invisible to component tests. They must keep passing, but they do not validate the RPC layer itself.