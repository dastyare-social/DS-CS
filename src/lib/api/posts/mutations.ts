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
  const base =
    process.env.S3_PUBLIC_BASE_URL &&
    process.env.S3_PUBLIC_BASE_URL.trim().length
      ? process.env.S3_PUBLIC_BASE_URL
      : process.env.S3_ENDPOINT || "";

  const rawUrl = joinUrl(base, BUCKET, key);
  return rawUrl.replace(/^([a-zA-Z][a-zA-Z0-9+\-.]*:)(\/)([^/])/, "$1//$3");
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

  switch (type) {
    case "image": {
      return {
        url: finalUrl,
        width: 0,
        height: 0,
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
        duration: 0,
        width: 0,
        height: 0,
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

type CreatePostInput = {
  content?: string | null;
  file?: File | null;
};

export async function createPostWithOptionalUpload({
  content,
  file,
}: CreatePostInput): Promise<PostWithReactions> {
  let type: PostType = "text";
  let media: MediaPayload = null;

  if (file) {
    const mime = (file as any).type ?? null;
    type = inferPostTypeFromMime(mime);
    const key = await uploadToS3(file, mime);
    media = await buildMediaFromFile(file, key, type);
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
}

export async function deletePostById(id: string): Promise<boolean> {
  const res = await db
    .delete(posts)
    .where(eq(posts.id, id))
    .returning({ id: posts.id });
  const success = res.length > 0;
  if (success) invalidatePostsCache();
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

  return {
    messageId: id,
    views: newViews,
  };
}
