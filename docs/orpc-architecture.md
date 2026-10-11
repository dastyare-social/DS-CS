# oRPC Architecture

Internal developer reference. Explains how the internal RPC layer works, why it is shaped the way it is, and how to add a procedure without breaking things.

> Replaced tRPC. See [`trpc-architecture.md`](./trpc-architecture.md) for the previous design and the reasoning behind the change.

---

## Purpose

oRPC serves one narrow job: an **internal, typed RPC channel between the React client and the server** for the posts and stories features.

It is **not** a public API. External integrations and AI agents use the REST API under `/api` (documented in `AGENTS.md` and OpenAPI). Do not add external-facing endpoints here.

---

## Files involved

| File | Role |
|---|---|
| `src/lib/orpc/router.ts` | The 18 procedures (11 posts + 7 stories) + Zod input schemas |
| `src/lib/orpc/client.ts` | Browser client — `RPCLink` + `resolveRpcUrl` |
| `src/app/api/rpc/[...path]/route.ts` | Route handler — catches `/api/rpc/<namespace>/<procedure>` |
| `src/lib/actions/posts.ts` | **Only** consumer of `posts.*` |
| `src/lib/actions/stories.ts` | **Only** consumer of `stories.*` |
| `src/lib/orpc/router.test.ts` | Integration tests for the transport layer |
| `public/sw.js` | Service Worker — caches `/api/rpc/` responses for offline feed |

---

## Core architecture

```
React components  ("use client", 9 files)
        │  import { getPosts, deletePost, ... }
        ▼
Action layer      src/lib/actions/{posts,stories}.ts
        │  orpc.posts.list(...)          ← thin, 1:1 wrapper per procedure
        ▼
Transport         RPCLink → POST /api/rpc/posts/list
        │  network round-trip (browser → server)
        ▼
Route handler     src/app/api/rpc/[...path]/route.ts   → RPCHandler
        │
        ▼
Router            src/lib/orpc/router.ts   (validates input, calls business logic)
        │
        ▼
Business logic    src/lib/api/posts/*, src/lib/api/stories/*
```

### Only the action layer may touch the client

Components must import from `@/lib/actions/*`. Importing `@/lib/orpc/client` from a component spreads transport concerns through the UI and makes the client impossible to swap later.

### The client is always the browser

All 9 consumers of the action layer are `"use client"` components. Server-side callers — e.g. `src/app/api/og/posts/[postId]/route.tsx` — import `@/lib/api/*` **directly** and never touch this layer. Keep it that way: a relative `/api/rpc` URL has no meaning on the server.

---

## Two things that will bite you

### 1. The RPC URL must be absolute

oRPC's `StandardRPCLink` does `new URL(baseUrl)`. A relative path throws at runtime:

```
TypeError: Failed to construct 'URL': Invalid URL
```

tRPC accepted relative URLs, so this fails **only at runtime** — it type-checks fine and the server-side tests pass. `resolveRpcUrl()` in `client.ts` exists solely to convert `/api/rpc` into an absolute URL using `window.location.origin`.

`RPCLink.url` accepts a function, and it is only invoked when a request is actually issued — which is why touching `window` inside it is safe during SSR. **Do not** "simplify" it to a string constant.

This class of bug is covered by `resolveRpcUrl` tests in `router.test.ts`.

### 2. The catch-all route segment is required

The client addresses procedures as `/api/rpc/posts/list`. A route at `src/app/api/rpc/route.ts` matches **only** the bare `/api/rpc`, so every real call 404s into the not-found page. The `[...path]` segment is what makes `/api/rpc/...` resolve.

Next.js does not strip the matched segment from `req.url`, so the handler still sees the full `/api/rpc/...` path — keep `prefix: "/api/rpc"`.

---

## Serialization: superjson is gone

The tRPC layer used **superjson** on both sides to keep `Date` objects intact across the wire. `PostWithReactions` carries real `Date` values (`createdAt`, `updatedAt`), and plain `JSON.stringify` would silently turn them into strings and break every relative-time render in the UI.

oRPC's Standard RPC serializer handles this **natively**. `STANDARD_RPC_JSON_SERIALIZER_BUILT_IN_TYPES` covers:

| Tag | Type |
|---|---|
| 0 | `BigInt` |
| 1 | `Date` |
| 2 | `NaN` |
| 3 | `undefined` |
| 4 | `URL` |
| 5 | `RegExp` |
| 6 | `Set` |
| 7 | `Map` |

So `superjson` was removed from `package.json` with no replacement needed. Verified by the `createdAt survives as a real Date` test in `router.test.ts`.

### Wire format

```
POST /api/rpc/posts/list
  request  → { "json": { "page": 1, "limit": 8 } }
  response → { "json": { "items": [...], "total": 3 }, "meta": [[1,"items",0,"createdAt"]] }
```

`meta` carries type tags for values JSON cannot express (`1` = `Date`). Dates still travel as plain ISO strings inside `json`; oRPC rehydrates them into `Date` on the client.

---

## Validation

Input schemas are Zod v4 objects passed straight to `os.input()`. Zod 4 implements **Standard Schema v1** natively, so no `@orpc/zod` adapter is needed — that package is deliberately not a dependency.

Output schemas are intentionally **not** declared, matching the tRPC layer. Adding them is a behaviour change (oRPC validates and strips on output), so treat it as a separate decision.

Validation failures return HTTP 400 with the Zod issues:

```json
{ "json": { "defined": false, "code": "BAD_REQUEST", "status": 400,
            "message": "Input validation failed", "data": { "issues": [...] } } }
```

---

## Errors

Procedures throw plain `Error` (e.g. `new Error("Post not found")`). oRPC masks undeclared errors as `INTERNAL_SERVER_ERROR` / "Internal server error" — unlike tRPC, which forwarded the original message.

This was accepted deliberately: **no UI reads the error text**. If you ever need a machine-readable code, declare errors with `os.errors({ ... })` rather than relying on message text.

---

## Adding a procedure

1. Add the business logic to `src/lib/api/posts/*` or `src/lib/api/stories/*` (never inline it in the router).
2. Declare the procedure in `src/lib/orpc/router.ts` with a Zod input if it takes arguments:

   ```ts
   myNewThing: os.input(z.object({ id: z.string().min(1) })).handler(async ({ input }) => {
     return doTheThing(input.id);
   }),
   ```

   No-argument procedures use `os.handler(async () => ...)`.

3. Wrap it in `src/lib/actions/posts.ts` (or `stories.ts`) — keep it a thin 1:1 pass-through, and preserve the existing `captureClientEvent` analytics calls where the sibling procedures have them.
4. Add a test to `src/lib/orpc/router.test.ts`.

---

## Service Worker coupling

`public/sw.js` intercepts `/api/rpc/` to power offline feed support. It is network-first, and on success it parses the response to populate IndexedDB.

Two couplings to keep in mind:

- `extractPostsFromResponse()` parses the oRPC `{ json, meta }` envelope. It skips error envelopes and stores `createdAt`/`updatedAt` as ISO strings. This is actually **more correct than the tRPC version**, which stored superjson's nested `{ json, meta }` objects into IndexedDB.
- `RPC_CACHE` was renamed from `trpc-cache-v1` when this layer was replaced. The `activate` handler explicitly deletes `trpc-cache-v1` so returning users don't keep dead responses. **Remove that cleanup line** once every deployed client has shipped the new worker.

See [`pwa-guide.md`](./pwa-guide.md) for the offline architecture.

---

## Testing

`src/lib/orpc/router.test.ts` mounts the **real** router behind a real `RPCHandler` and drives it through a real `RPCLink`, mocking only the business-logic layer. This matters because every other test mocks at `@/lib/actions/*` — meaning nothing else in the suite covers the transport at all.

What it guards:

- `Date` survives the round trip as a `Date` (the superjson replacement)
- Zod input validation still rejects bad input
- Bare-array returns (`posts.pinned`) vs object returns (`posts.list`)
- No-input and mutation procedures
- `resolveRpcUrl()` produces a valid absolute URL

Run the whole suite with `bun test`.

---

## Request batching difference

tRPC's `httpBatchLink` coalesced concurrent calls into a single HTTP request. oRPC's `RPCLink` does not batch — N concurrent calls are N requests.

`src/lib/stores/posts.ts` fires `Promise.all([getPosts(...), countPosts()])` in two places, so those went from 1 request to 2. This is a minor extra request on feed load, not a correctness issue. If it becomes measurable, the fix is a combined procedure (as `posts.exploreInitial` already does for explore), not reintroducing batching.