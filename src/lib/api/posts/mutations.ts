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
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import type {
  MediaPayload,
  PostType,
  PostWithReactions,
} from "./queries";
import { getPostById, invalidatePostsCache } from "./queries";
import { sendPushNotification } from "@/lib/notifications/push";
import { captureServerEvent } from "@/lib/analytics/server";
import { getMediaDimensions } from "@/lib/utils/media";

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  endpoint: process.env.S3_ENDPOINT || undefined,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
});

const BUCKET = process.env.S3_BUCKET_NAME!;

function joinUrl(base: string, ...parts: string[]): string {
  const trimmedBase = base.replace(/\/+$/, "");
  const cleanedParts = parts.map((p) => p.replace(/^\/+/, ""));
  return [trimmedBase, ...cleanedParts].join("/");
}

function buildPublicFileUrl(key: string): string {
  // Use S3_PUBLIC_BASE_URL if explicitly set (recommended for all providers)
  if (process.env.S3_PUBLIC_BASE_URL && process.env.S3_PUBLIC_BASE_URL.trim().length) {
    return joinUrl(process.env.S3_PUBLIC_BASE_URL, key);
  }

  // Fallback: try to construct public URL from S3_ENDPOINT
  const endpoint = process.env.S3_ENDPOINT || "";
  if (!endpoint) {
    throw new Error("S3_PUBLIC_BASE_URL or S3_ENDPOINT must be set");
  }

  // Handle Supabase: convert storage endpoint to public URL
  if (endpoint.includes(".storage.supabase.co")) {
    const publicUrl = endpoint
      .replace(".storage.supabase.co", ".supabase.co")
      .replace("/storage/v1/s3", "/storage/v1/object/public");
    return joinUrl(publicUrl, BUCKET, key);
  }

  // For other S3-compatible providers (MinIO, R2, AWS S3), use endpoint with bucket
  return joinUrl(endpoint, BUCKET, key);
}

export function inferPostTypeFromMime(mime: string | null): PostType {
  if (!mime) return "text";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "voice";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

export async function buildMediaFromFile(
  file: File | Blob,
  key: string,
  type: PostType
): Promise<MediaPayload> {
  const size = (file as any).size ?? 0;
  const name = (file as any).name ?? key;
  const mimeType = (file as any).type ?? "application/octet-stream";

  const finalUrl = buildPublicFileUrl(key);

  // Get dimensions for images and videos
  let dimensions: { width: number; height: number; duration?: number } = { width: 0, height: 0, duration: 0 };
  if (type === "image" || type === "video") {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    dimensions = await getMediaDimensions(buffer, mimeType);
  }

  switch (type) {
    case "image": {
      return {
        url: finalUrl,
        width: dimensions.width,
        height: dimensions.height,
      };
    }
    case "voice": {
      return {
        url: finalUrl,
        duration: 0,
        waveform: [],
      };
    }
    case "video": {
      return {
        url: finalUrl,
        duration: dimensions.duration || 0,
        width: dimensions.width,
        height: dimensions.height,
      };
    }
    case "file": {
      return {
        url: finalUrl,
        filename: name,
        filesize: size,
        mimeType,
      };
    }
    case "text":
    default:
      return null;
  }
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

export async function uploadToS3(
  file: File | Blob,
  mimeType: string | null
): Promise<string> {
  const ext = (mimeType && mimeType.split("/")[1]) || "bin";
  const key = `posts/${randomUUID()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType || "application/octet-stream",
    })
  );

  return key;
}

type MediaInput = {
  file?: File | null;
  url?: string | null;
  type?: PostType | null;
  dimensions?: { width: number; height: number; duration?: number } | undefined;
};

type CreatePostInput = {
  content?: string | null;
  file?: File | null;
  media?: MediaInput[] | null;
};

export async function createPostWithOptionalUpload({
  content,
  file,
  media: mediaInputs,
}: CreatePostInput): Promise<PostWithReactions> {
  let type: PostType = "text";
  let media: MediaPayload = null;

  // Handle legacy single file upload
  if (file && !mediaInputs) {
    const mime = (file as any).type ?? null;
    type = inferPostTypeFromMime(mime);
    const key = await uploadToS3(file, mime);
    media = await buildMediaFromFile(file, key, type);
  }
  // Handle new media inputs (multiple files/URLs)
  else if (mediaInputs && mediaInputs.length > 0) {
    const firstMedia = mediaInputs[0];
    
    if (firstMedia.file) {
      // Upload file and build media
      const mime = (firstMedia.file as any).type ?? null;
      type = inferPostTypeFromMime(mime);
      const key = await uploadToS3(firstMedia.file, mime);
      media = await buildMediaFromFile(firstMedia.file, key, type);
    } else if (firstMedia.url) {
      // Use URL directly
      type = firstMedia.type || inferPostTypeFromMime(null);
      media = await buildMediaFromUrl(
        firstMedia.url,
        type,
        firstMedia.dimensions
      );
    }
  }

  const now = new Date();

  const parsedBase = insertPostsSchema.parse({
    type,
    content: content ?? null,
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

    await sendPushNotification({
      title: "New post published",
      body: content ? content.slice(0, 80) : "A new post is now available",
      url: "/",
    });
  }

  return {
    ...inserted,
    reactions: [],
  };
}

type UpdatePostInput = {
  id: string;
  patch: z.infer<typeof patchPostsSchema>;
};

export async function updatePost({
  id,
  patch,
}: UpdatePostInput): Promise<PostWithReactions | null> {
  const parsed = patchPostsSchema.parse(patch);

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
}

export async function deletePostById(id: string): Promise<boolean> {
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

  const updated = await updatePost({ id, patch: { views: newViews } });
  if (!updated) return null;

  await captureServerEvent("post_viewed", {
    post_id: id,
    views: newViews,
  });

  return {
    messageId: id,
    views: newViews,
  };
}
