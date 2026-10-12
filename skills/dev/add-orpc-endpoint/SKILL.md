---
name: add-orpc-endpoint
description: Add an internal oRPC procedure to the DS-CS router — the typed channel between the React client and the server. Use when adding a posts/stories procedure, exposing new server logic to the UI, or when an oRPC call 404s at runtime. For external/public endpoints use the REST layer under src/app/api instead — this skill is internal-only.
---

# Adding an oRPC procedure

## What this layer is

oRPC is the **internal, typed RPC channel between the React client and the server** for posts and stories. It is not a public API — external integrations and AI agents use REST under `src/app/api`. Do not add external-facing endpoints here.

The transport path, end to end:

```
"use client" component
      │  import { getPosts } from "@/lib/actions/posts"
      ▼
src/lib/actions/posts.ts          thin 1:1 wrapper, owns analytics calls
      │  orpc.posts.list(input)
      ▼
RPCLink → POST /api/rpc/posts/list
      ▼
src/app/api/rpc/[...path]/route.ts   RPCHandler
      ▼
src/lib/orpc/router.ts               validates input, calls business logic
      ▼
src/lib/api/posts/*.ts               the actual work
```

## The five rules

1. **Business logic goes in `src/lib/api/*`.** Never inline a database query in the router. The router validates and delegates.
2. **Components import from `@/lib/actions/*`, never `@/lib/orpc/client`.** Transport concerns in a component make the client impossible to swap later.
3. **One procedure, one action wrapper, 1:1.** No action wraps two procedures; no procedure has two actions.
4. **Declare an input schema only if the procedure takes arguments.** `os.handler(...)` with no `.input()` for zero-arg procedures.
5. **Add a test** to `src/lib/orpc/router.test.ts`.

## Step 1 — the business logic

Add to the matching module, `src/lib/api/posts/index.ts` or `src/lib/api/stories/index.ts`:

```ts
export async function getPostStats(id: string) {
  const rows = await db.select().from(posts).where(eq(posts.id, id));
  if (rows.length === 0) {
    throw new Error("Post not found");
  }
  return { views: rows[0].views, media: rows[0].media };
}
```

Throw a plain `Error` for the not-found case. Procedures throw plain `Error` throughout this codebase; oRPC masks the message as `INTERNAL_SERVER_ERROR` for the client, and no UI reads the text. If you need a machine-readable code, declare errors with `os.errors({ ... })` instead of relying on message text.

## Step 2 — the procedure

Add to `postsRouter` or `storiesRouter` in `src/lib/orpc/router.ts`. Import the business function at the top of the file alongside its siblings.

With input:

```ts
  getStats: os.input(postIdInput).handler(async ({ input }) => {
    return getPostStats(input.id);
  }),
```

Reuse an existing input schema when one fits — `postIdInput` is `z.object({ id: z.string().min(1) })`. Define a new one near the others only when the shape is genuinely different:

```ts
const postStatsInput = z.object({
  id: z.string().min(1),
  includeDrafts: z.boolean().optional(),
});
```

Without input:

```ts
  count: os.handler(async () => ({ total: await countPosts() })),
```

Input schemas are plain Zod v4 objects passed straight to `os.input()`. Zod 4 implements Standard Schema v1 natively, so there is no adapter package to import.

**Output schemas are intentionally not declared.** Adding one is a behaviour change — oRPC will validate and strip on output. Do not add one as a drive-by.

## Step 3 — the action wrapper

Add to `src/lib/actions/posts.ts` (or `stories.ts`). Thin, 1:1, with the same defaulting the sibling wrappers do:

```ts
export async function getPostStats(id: string) {
  const result = await orpc.posts.getStats({ id });
  void captureClientEvent("post_stats_viewed", { post_id: id });
  return result;
}
```

Preserve the `captureClientEvent` call where sibling procedures in that file have one. Analytics calls live in the action layer, not the router — that is the whole reason the layer exists.

## Step 4 — the test

`src/lib/orpc/router.test.ts` mounts the real router behind a real `RPCHandler` and drives it through a real `RPCLink`, mocking only the business-logic layer. Add a case alongside the existing ones:

```ts
it("returns stats for a post", async () => {
  const client = makeTestClient();
  const result = await client.posts.getStats({ id: "post-1" });
  expect(result.views).toBe("42");
});

it("rejects an empty post id", async () => {
  const client = makeTestClient();
  await expect(client.posts.getStats({ id: "" })).rejects.toThrow();
});
```

Run `bun test` (never `bun test --isolate` alone — AGENTS.md requires the isolate flag via `bun run test`).

## Two things that will bite you

### The RPC URL must be absolute

oRPC's `StandardRPCLink` does `new URL(baseUrl)`, which throws on a relative path. `resolveRpcUrl()` in `src/lib/orpc/client.ts` converts `/api/rpc` to an absolute URL using `window.location.origin`. It is a **function**, not a string constant, because `RPCLink.url` only invokes it when a request is actually issued — which is what makes touching `window` safe during SSR. Do not "simplify" it to a constant; the failure appears only at runtime, while type-checking passes.

### The catch-all route segment is required

The client addresses procedures as `/api/rpc/posts/list`. A route at `src/app/api/rpc/route.ts` matches only the bare `/api/rpc`, so every real call 404s into the not-found page. The `[...path]` segment is what makes `/api/rpc/...` resolve.

## Dates survive on their own

oRPC's Standard RPC serializer handles `Date`, `BigInt`, `Map`, `Set`, `URL`, `RegExp`, `NaN` and `undefined` natively via type tags in the response `meta` array. `superjson` was removed and is not needed. `PostWithReactions.createdAt` arrives at the client as a real `Date` — do not re-parse it, and do not add a serialization library.

## Service Worker coupling

`public/sw.js` intercepts `/api/rpc/` for the offline feed. `extractPostsFromResponse()` parses the `{ json, meta }` envelope and stores `createdAt`/`updatedAt` as ISO strings. If you add a procedure whose response the feed depends on, check whether the extractor needs to know about it.

## Verify

```bash
bun run test        # full suite, isolated
bun run lint
```

Then, if the procedure is reachable from a screen, run the app and click through the actual flow. A procedure that type-checks and passes its unit test can still 404 at runtime for the two reasons above.
