import { desc, eq, ilike, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema/posts";
import { reactions } from "@/lib/db/schema/reactions";

export type PostType = "text" | "image" | "video" | "voice" | "file";

export type ImageMedia = {
  url: string;
  thumbnail?: string;
  width: number;
  height: number;
  caption?: string;
};

export type VoiceMedia = {
  url: string;
  duration: number;
  waveform: number[];
};

export type VideoMedia = {
  url: string;
  thumbnail?: string;
  duration: number;
  width: number;
  height: number;
  caption?: string;
};

export type FileMedia = {
  url: string;
  filename: string;
  filesize: number;
  mimeType: string;
};

export type MediaPayload =
  | ImageMedia
  | VoiceMedia
  | VideoMedia
  | FileMedia
  | null;

export type PostWithReactions = {
  id: string;
  type: PostType;
  content: string | null;
  views: string;
  pinnedAt: Date | null;
  media: MediaPayload;
  createdAt: Date | null;
  updatedAt: Date | null;
  reactions: {
    emoji: string;
    count: number;
  }[];
  /** Client-only status for optimistic posts (not persisted to DB) */
  _status?: "sending" | "error";
  /** Preserve content for retry after error */
  _pendingContent?: string | null;
  /** Preserve media inputs for retry after error */
  _pendingMedia?: PendingMediaInput[];
};

export type GetPostsParams = {
  page?: number;
  limit?: number;
  search?: string;
  bypassCache?: boolean;
};

type PostsCacheEntry = {
  value: {
    items: PostWithReactions[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  ts: number;
};

type PendingMediaInput = {
  url?: string | null;
  type?: PostType | null;
  dimensions?: {
    width: number;
    height: number;
    duration?: number;
  };
};

declare global {
  var _postsCountCache: { value: number; ts: number } | undefined;
  var _postsWithReactionsCache: Record<string, PostsCacheEntry> | undefined;
}

function getPostsCacheKey({ page = 1, limit = 20, search }: GetPostsParams) {
  return `page=${page},limit=${limit},search=${search ?? ""}`;
}

export function invalidatePostsCache() {
  if (globalThis._postsCountCache) {
    globalThis._postsCountCache = { value: 0, ts: 0 };
  }
  if (globalThis._postsWithReactionsCache) {
    globalThis._postsWithReactionsCache = {};
  }
}

export async function getPostsWithReactions({
  page = 1,
  limit = 20,
  search,
  bypassCache = false,
}: GetPostsParams): Promise<{
  items: PostWithReactions[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}> {
  const cacheKey = getPostsCacheKey({ page, limit, search });
  const TTL = 10_000; // 10 seconds
  let cache = globalThis._postsWithReactionsCache;
  if (!cache) {
    cache = {};
    globalThis._postsWithReactionsCache = cache;
  }
  const now = Date.now();
  if (!bypassCache && cache[cacheKey] && now - cache[cacheKey].ts < TTL) {
    return cache[cacheKey].value;
  }

  const offset = (page - 1) * limit;
  const where = search ? ilike(posts.content, `%${search}%`) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(posts)
      .where(where)
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: sql<number>`count(*)` })
      .from(posts)
      .where(where),
  ]);

  const total = Number(totalRows[0]?.value || 0);
  const hasMore = page * limit < total;

  const ids = rows.map((m) => m.id);
  let reactionsRows: { postId: string; emoji: string; count: number }[] = [];

  if (ids.length) {
    reactionsRows = await db
      .select({
        postId: reactions.postId,
        emoji: reactions.emoji,
        count: reactions.count,
      })
      .from(reactions)
      .where(inArray(reactions.postId, ids));
  }

  const grouped: Record<string, { emoji: string; count: number }[]> = {};
  for (const row of reactionsRows) {
    if (!grouped[row.postId]) grouped[row.postId] = [];
    grouped[row.postId].push({ emoji: row.emoji, count: row.count });
  }

  const items: PostWithReactions[] = rows.map((m) => ({
    ...m,
    media: m.media as MediaPayload,
    reactions: grouped[m.id] ?? [],
  }));

  const result = { items, page, limit, total, hasMore };
  cache[cacheKey] = { value: result, ts: Date.now() };
  return result;
}

export async function countPosts(): Promise<number> {
  const TTL = 30_000; // 30 seconds
  let cache = globalThis._postsCountCache;
  if (!cache) {
    cache = { value: 0, ts: 0 };
    globalThis._postsCountCache = cache;
  }
  const now = Date.now();
  if (now - cache.ts < TTL) return cache.value;

  try {
    const [row] = await db
      .select({ value: sql<number>`count(*)` })
      .from(posts);
    const val = Number(row?.value || 0);
    cache.value = val;
    cache.ts = Date.now();
    return val;
  } catch (err: unknown) {
    console.error(
      "countPosts DB error:",
      err instanceof Error ? err.message : String(err),
      err instanceof Error ? err.stack ?? "" : ""
    );
    return cache.value ?? 0;
  }
}

export async function getPostById(
  id: string
): Promise<PostWithReactions | null> {
  const [post] = await db.select().from(posts).where(eq(posts.id, id));
  if (!post) return null;

  const reactionsRows = await db
    .select({
      emoji: reactions.emoji,
      count: reactions.count,
    })
    .from(reactions)
    .where(eq(reactions.postId, id));

  return {
    ...post,
    media: post.media as MediaPayload,
    reactions: reactionsRows,
  };
}

export async function getPinnedPosts(): Promise<PostWithReactions[]> {
  const rows = await db
    .select()
    .from(posts)
    .where(isNotNull(posts.pinnedAt))
    .orderBy(desc(posts.createdAt));

  if (rows.length === 0) return [];

  const ids = rows.map((m) => m.id);
  const reactionsRows = await db
    .select({
      postId: reactions.postId,
      emoji: reactions.emoji,
      count: reactions.count,
    })
    .from(reactions)
    .where(inArray(reactions.postId, ids));

  const grouped: Record<string, { emoji: string; count: number }[]> = {};
  for (const row of reactionsRows) {
    if (!grouped[row.postId]) grouped[row.postId] = [];
    grouped[row.postId].push({ emoji: row.emoji, count: row.count });
  }

  return rows.map((m) => ({
    ...m,
    media: m.media as MediaPayload,
    reactions: grouped[m.id] ?? [],
  }));
}
