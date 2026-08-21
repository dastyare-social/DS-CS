import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema/posts";
import { reactions } from "@/lib/db/schema/reactions";
import {
  insertPostsSchema,
  patchPostsSchema,
} from "@/lib/db/schema/posts";
import { insertReactionsSchema } from "@/lib/db/schema/reactions";
import { z } from "zod";
import { captureServerEvent, flushServerEvents } from "@/lib/analytics/server";
import { randomUUID } from "crypto";
import { app_config } from "@/config/app";
import type {
  MediaPayload,
  PostType,
  PostWithReactions,
} from "./queries";
import { getPostById, invalidatePostsCache } from "./queries";
import { sendPushNotification } from "@/lib/notifications/push";
import { shortenContentUrls } from "@/lib/shorten";
import { getMediaDimensionsFromUrl } from "@/lib/utils/media";
import { assertWritable } from "@/lib/demo-mode";

export function inferPostTypeFromUrl(url: string): PostType {
  const lowerUrl = url.toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
  const videoExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];
  const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];

  for (const ext of imageExts) {
    if (lowerUrl.endsWith(ext)) return "image";
  }
  for (const ext of videoExts) {
    if (lowerUrl.endsWith(ext)) return "video";
  }
  for (const ext of audioExts) {
    if (lowerUrl.endsWith(ext)) return "voice";
  }
  return "file";
}

export async function buildMediaFromUrl(
  url: string,
  type: PostType,
  dimensions?: { width: number; height: number; duration?: number }
): Promise<MediaPayload> {
  switch (type) {
    case "image": {
      return {
        url,
        width: dimensions?.width || 0,
        height: dimensions?.height || 0,
      };
    }
    case "voice": {
      return {
        url,
        duration: dimensions?.duration || 0,
        waveform: [],
      };
    }
    case "video": {
      return {
        url,
        duration: dimensions?.duration || 0,
        width: dimensions?.width || 0,
        height: dimensions?.height || 0,
      };
    }
    case "file": {
      return {
        url,
        filename: url.split("/").pop() || "file",
        filesize: 0,
        mimeType: "application/octet-stream",
      };
    }
    case "text":
    default:
      return null;
  }
}

export type PostMediaInput = {
  url: string;
  type?: PostType | null;
  width?: number;
  height?: number;
  duration?: number;
};

type CreatePostInput = {
  content?: string | null;
  media?: PostMediaInput[] | null;
};

async function resolveMediaDimensions(
  input: PostMediaInput,
  type: PostType
): Promise<{ width: number; height: number; duration?: number }> {
  if (input.width || input.height || input.duration) {
    return {
      width: input.width || 0,
      height: input.height || 0,
      duration: input.duration,
    };
  }

  if (type === "image" || type === "video") {
    return getMediaDimensionsFromUrl(input.url, type);
  }

  return { width: 0, height: 0 };
}

async function buildMediaForInput(input: PostMediaInput): Promise<{
  type: PostType;
  media: MediaPayload;
}> {
  const type = input.type || inferPostTypeFromUrl(input.url);
  const dimensions = await resolveMediaDimensions(input, type);
  return { type, media: await buildMediaFromUrl(input.url, type, dimensions) };
}

async function insertPost({
  type,
  content,
  media,
  push = true,
}: {
  type: PostType;
  content: string | null;
  media: MediaPayload | MediaPayload[] | null;
  push?: boolean;
}): Promise<PostWithReactions> {
  const now = new Date();

  const processedContent = content ? await shortenContentUrls(content) : null;

  const parsedBase = insertPostsSchema.parse({
    type,
    content: processedContent,
    views: "0",
    pinnedAt: null,
    media,
  });

  const toInsert = {
    id: randomUUID(),
    ...parsedBase,
    createdAt: now,
    updatedAt: now,
  };

  const [inserted] = await db.insert(posts).values(toInsert).returning();
  invalidatePostsCache();

  if (inserted) {
    await captureServerEvent("post_created", {
      post_id: inserted.id,
      post_type: type,
      has_media: Boolean(media),
      content_length: content?.length ?? 0,
    });
    await flushServerEvents();

    if (push) {
      await sendPushNotification({
        title: "New Post",
        body: content ? content.slice(0, 80) : "A new post is now available",
        url: "/",
      });
    }
  }

  return {
    ...inserted,
    reactions: [],
  };
}

export type CreatePostResult =
  | PostWithReactions
  | { _multiple: true; posts: PostWithReactions[] };

export async function createPost({
  content,
  media: mediaInputs,
}: CreatePostInput): Promise<CreatePostResult> {
  assertWritable();
  if (mediaInputs && mediaInputs.length === 1) {
    const { type, media } = await buildMediaForInput(mediaInputs[0]);
    return insertPost({ type, content: content ?? null, media });
  }

  if (mediaInputs && mediaInputs.length > 1) {
    const allImages = mediaInputs.every(
      (input) => (input.type || inferPostTypeFromUrl(input.url)) === "image"
    );

    if (allImages) {
      const mediaArray: MediaPayload[] = [];
      for (const input of mediaInputs) {
        const { media } = await buildMediaForInput(input);
        mediaArray.push(media);
      }
      return insertPost({
        type: "image",
        content: content ?? null,
        media: mediaArray,
      });
    }

    const createdPosts: PostWithReactions[] = [];
    for (let i = 0; i < mediaInputs.length; i++) {
      const { type, media } = await buildMediaForInput(mediaInputs[i]);
      const itemContent = i === 0 ? content : "— content —";
      const created = await insertPost({
        type,
        content: itemContent ?? null,
        media,
        push: i === 0,
      });
      createdPosts.push(created);
    }

    return {
      _multiple: true,
      posts: createdPosts,
    };
  }

  return insertPost({ type: "text", content: content ?? null, media: null });
}

type UpdatePostInput = {
  id: string;
  patch: z.infer<typeof patchPostsSchema>;
};

async function updatePostInternal({
  id,
  patch,
}: UpdatePostInput): Promise<PostWithReactions | null> {
  const processedPatch = { ...patch };
  if (typeof processedPatch.content === "string") {
    processedPatch.content = await shortenContentUrls(processedPatch.content);
  }

  const parsed = patchPostsSchema.parse(processedPatch);

  const [updated] = await db
    .update(posts)
    .set({
      ...parsed,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id))
    .returning();

  if (!updated) return null;
  invalidatePostsCache();

  await captureServerEvent("post_updated", {
    post_id: id,
    updated_fields: Object.keys(parsed),
    post_type: updated.type,
  });

  const reactionsRows = await db
    .select({
      emoji: reactions.emoji,
      count: reactions.count,
    })
    .from(reactions)
    .where(eq(reactions.postId, id));

  return {
    ...updated,
    reactions: reactionsRows,
  };
}

export async function updatePost({
  id,
  patch,
}: UpdatePostInput): Promise<PostWithReactions | null> {
  assertWritable();
  return updatePostInternal({ id, patch });
}

export async function batchIncrementViews(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  await db
    .update(posts)
    .set({
      views: sql`(${posts.views}::integer + 1)::text`,
      updatedAt: new Date(),
    })
    .where(inArray(posts.id, ids));

  await captureServerEvent("post_batch_viewed", {
    post_ids: ids,
    count: ids.length,
  });
  await flushServerEvents();
}

export async function deletePostById(id: string): Promise<boolean> {
  assertWritable();
  const res = await db
    .delete(posts)
    .where(eq(posts.id, id))
    .returning({ id: posts.id });
  const success = res.length > 0;
  if (success) {
    invalidatePostsCache();
    await captureServerEvent("post_deleted", {
      post_id: id,
    });
    await flushServerEvents();
  }
  return success;
}

type AddReactionInput = {
  postId: string;
  emoji: string;
};

export async function addReaction({
  postId,
  emoji,
}: AddReactionInput): Promise<{
  postId: string;
  emoji: string;
  count: number;
}> {
  const data = insertReactionsSchema.parse({
    postId,
    emoji,
  });

  const whereClause = and(
    eq(reactions.postId, data.postId),
    eq(reactions.emoji, data.emoji)
  );

  const existing = await db.select().from(reactions).where(whereClause);

  let row;
  if (existing.length) {
    [row] = await db
      .update(reactions)
      .set({
        count: existing[0].count + 1,
        updatedAt: new Date(),
      })
      .where(whereClause)
      .returning();
  } else {
    [row] = await db
      .insert(reactions)
      .values({
        ...data,
        count: 1,
      })
      .returning();
  }

  invalidatePostsCache();

  await captureServerEvent("post_reacted", {
    post_id: postId,
    emoji,
    reaction_count: row.count,
  });
  await flushServerEvents();

  return {
    postId: row.postId,
    emoji: row.emoji,
    count: row.count,
  };
}

export async function viewPost(
  id: string
): Promise<{ messageId: string; views: string } | null> {
  const post = await getPostById(id);
  if (!post) return null;

  const currentViews = Number(post.views || "0");
  const newViews = String(currentViews + 1);

  const updated = await updatePostInternal({ id, patch: { views: newViews } });
  if (!updated) return null;

  await captureServerEvent("post_viewed", {
    post_id: id,
    views: newViews,
  });
  await flushServerEvents();

  return {
    messageId: id,
    views: newViews,
  };
}
