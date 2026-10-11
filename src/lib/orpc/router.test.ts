import { describe, it, expect, mock, beforeAll } from "bun:test";
import type { RouterClient } from "@orpc/server";
import type { AppRouter } from "@/lib/orpc/router";
// Safe to import at module scope: the link only resolves its URL lazily, when
// a request is actually issued, so nothing here touches `window`.
import { resolveRpcUrl, RPC_BASE_PATH_CONST } from "@/lib/orpc/client";

const FIXED = new Date("2024-01-02T03:04:05.678Z");

const post = {
  id: "p1",
  type: "text",
  content: "hello",
  media: null,
  reactions: [],
  views: "7",
  pinnedAt: null,
  createdAt: FIXED,
  updatedAt: null,
};

// Mock the business-logic layer; the router under test is the REAL one.
mock.module("@/lib/api/posts", () => ({
  getPostsWithReactions: async () => ({
    items: [post],
    total: 1,
    page: 1,
    limit: 8,
    hasMore: false,
  }),
  countPosts: async () => 42,
  getPinnedPosts: async () => [post],
  getPostById: async (id: string) => (id === "p1" ? post : null),
  createPost: async () => post,
  batchIncrementViews: async () => undefined,
  addReaction: async () => ({ count: 3 }),
  viewPost: async () => post,
  deletePostById: async () => true,
  updatePost: async () => post,
}));

mock.module("@/lib/api/stories", () => ({
  getStories: async () => ({ items: [], total: 0, page: 1, limit: 8, hasMore: false }),
  countStories: async () => 7,
  getStoryById: async () => null,
  incrementStoryViews: async () => ({ views: 3 }),
  toggleStoryLike: async () => ({ likes: 2 }),
  createStory: async () => ({ id: "s1" }),
  deleteStoryById: async () => true,
}));

let orpc: RouterClient<AppRouter>;

beforeAll(async () => {
  const { RPCHandler } = await import("@orpc/server/fetch");
  const { appRouter } = await import("@/lib/orpc/router");
  const { createORPCClient } = await import("@orpc/client");
  const { RPCLink } = await import("@orpc/client/fetch");

  const handler = new RPCHandler(appRouter);
  const server = Bun.serve({
    port: 0,
    fetch: async (req: Request) => {
      const { matched, response } = await handler.handle(req, { prefix: "/api/rpc" });
      return matched ? response : new Response("nf", { status: 404 });
    },
  });

  orpc = createORPCClient(new RPCLink({ url: `http://localhost:${server.port}/api/rpc` }));
});

describe("oRPC layer (real router, mocked business logic)", () => {
  it("posts.list returns items over the wire", async () => {
    const res = await orpc.posts.list({ page: 1, limit: 8, type: "list" });
    expect(res.items).toHaveLength(1);
    expect(res.items[0].id).toBe("p1");
    expect(res.total).toBe(1);
  });

  it("REGRESSION: createdAt survives as a real Date (superjson replacement)", async () => {
    const res = await orpc.posts.list({ page: 1, limit: 8, type: "list" });
    const d = res.items[0].createdAt;
    expect(d instanceof Date).toBe(true);
    expect((d as Date).toISOString()).toBe("2024-01-02T03:04:05.678Z");
  });

  it("posts.pinned returns a bare array", async () => {
    const res = await orpc.posts.pinned();
    expect(Array.isArray(res)).toBe(true);
    expect(res[0].id).toBe("p1");
    expect(res[0].createdAt instanceof Date).toBe(true);
  });

  it("posts.count returns a number", async () => {
    const res = await orpc.posts.count();
    expect(res.total).toBe(42);
  });

  it("stories.count works", async () => {
    const res = await orpc.stories.count();
    expect(res.total).toBe(7);
  });

  it("input validation rejects a bad id (zod still enforced)", async () => {
    await expect(orpc.posts.getById({ id: "" })).rejects.toThrow();
  });

  it("missing record throws and surfaces as ORPCError", async () => {
    await expect(orpc.posts.getById({ id: "nope" })).rejects.toThrow();
  });

  it("mutations work", async () => {
    const r = await orpc.posts.addReaction({ postId: "p1", emoji: "🔥" });
    expect(r.count).toBe(3);
  });

  it("no-input procedure (stories.view) works", async () => {
    const r = await orpc.stories.view({ id: "s1" });
    expect(r.views).toBe(3);
  });
});

describe("resolveRpcUrl — relative-URL regression", () => {
  // oRPC's StandardRPCLink calls `new URL(baseUrl)`, which throws
  // "Failed to construct 'URL': Invalid URL" for a relative path. tRPC allowed
  // relative URLs, so this broke at runtime while type-checking fine.
  const withWindow = <T>(origin: string | undefined, fn: () => T): T => {
    const g = globalThis as { window?: { location: { origin: string } } };
    const prev = g.window;
    if (origin === undefined) delete g.window;
    else g.window = { location: { origin } };
    try {
      return fn();
    } finally {
      if (prev === undefined) delete g.window;
      else g.window = prev;
    }
  };

  it("produces an absolute, parseable URL", () => {
    const url = withWindow("https://cs.example.com", () => resolveRpcUrl());
    expect(() => new URL(url)).not.toThrow();
    expect(url).toBe(`https://cs.example.com${RPC_BASE_PATH_CONST}`);
  });

  it("keeps a non-default port", () => {
    const url = withWindow("http://localhost:8731", () => resolveRpcUrl());
    expect(url).toBe("http://localhost:8731/api/rpc");
  });

  it("throws a clear error outside the browser instead of an invalid URL", () => {
    expect(() => withWindow(undefined, () => resolveRpcUrl())).toThrow(
      /outside the browser/,
    );
  });
});