import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema/stories";
import {
  insertStoriesSchema,
  patchStoriesSchema,
} from "@/lib/db/schema/stories";
import { z } from "zod";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import type {
  StoryItem,
  StoryMediaPayload,
  StoryType,
} from "./queries";
import { getStoryById } from "./queries";

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

function buildPublicStoryFileUrl(key: string): string {
  const base =
    process.env.S3_PUBLIC_BASE_URL &&
    process.env.S3_PUBLIC_BASE_URL.trim().length
      ? process.env.S3_PUBLIC_BASE_URL
      : process.env.S3_ENDPOINT || "";

  const rawUrl = joinUrl(base, BUCKET, key);
  return rawUrl.replace(/^([a-zA-Z][a-zA-Z0-9+\-.]*:)(\/)([^/])/, "$1//$3");
}

export function inferStoryTypeFromMime(mime: string | null): StoryType {
  if (!mime) return "image";
  if (mime.startsWith("video/")) return "video";
  return "image";
}

export async function buildStoryMediaFromFile(
  file: File | Blob,
  key: string,
  type: StoryType
): Promise<StoryMediaPayload> {
  const mimeType = (file as any).type ?? "application/octet-stream";
  const finalUrl = buildPublicStoryFileUrl(key);

  switch (type) {
    case "image": {
      return {
        url: finalUrl,
        width: 0,
        height: 0,
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
    default:
      return null;
  }
}

export async function uploadStoryToS3(
  file: File | Blob,
  mimeType: string | null
): Promise<string> {
  const ext = (mimeType && mimeType.split("/")[1]) || "bin";
  const key = `stories/${randomUUID()}.${ext}`;
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

type CreateStoryInput = {
  type?: StoryType | null;
  views?: string | null;
  likes?: string | null;
  media?: StoryMediaPayload | any | null;
  file?: File | null;
};

export async function createStoryWithOptionalUpload({
  type,
  views,
  likes,
  media,
  file,
}: CreateStoryInput): Promise<StoryItem> {
  let finalType: StoryType = type ?? "image";
  let finalMedia: StoryMediaPayload | any = media ?? null;

  if (file) {
    const mime = (file as any).type ?? null;
    finalType = inferStoryTypeFromMime(mime);
    const key = await uploadStoryToS3(file, mime);
    finalMedia = await buildStoryMediaFromFile(file, key, finalType);
  }

  const now = new Date();

  const parsedBase = insertStoriesSchema.parse({
    type: finalType,
    views: views ?? "0",
    likes: likes ?? "0",
    media: finalMedia,
  });

  const toInsert = {
    id: randomUUID(),
    ...parsedBase,
    createdAt: now,
    updatedAt: now,
  };

  const [inserted] = await db.insert(stories).values(toInsert).returning();

  return {
    ...inserted,
  };
}

type UpdateStoryInput = {
  id: string;
  patch: z.infer<typeof patchStoriesSchema>;
};

export async function updateStory({
  id,
  patch,
}: UpdateStoryInput): Promise<StoryItem | null> {
  const parsed = patchStoriesSchema.parse(patch);

  const [updated] = await db
    .update(stories)
    .set({
      ...parsed,
      updatedAt: new Date(),
    })
    .where(eq(stories.id, id))
    .returning();

  if (!updated) return null;
  return {
    ...updated,
  };
}

export async function deleteStoryById(id: string): Promise<boolean> {
  const res = await db
    .delete(stories)
    .where(eq(stories.id, id))
    .returning({ id: stories.id });
  return res.length > 0;
}

export async function incrementStoryViews(
  id: string
): Promise<{ storyId: string; views: string } | null> {
  const existing = await getStoryById(id);
  if (!existing) return null;

  const currentViews = Number(existing.views || "0");
  const newViews = String(currentViews + 1);

  const updated = await updateStory({ id, patch: { views: newViews } });
  if (!updated) return null;

  return { storyId: id, views: newViews };
}

export async function toggleStoryLike(
  id: string,
  direction: "inc" | "dec"
) {
  const existing = await getStoryById(id);
  if (!existing) return null;

  const currentLikes = Number(existing.likes || "0");
  const newLikes =
    direction === "inc"
      ? String(currentLikes + 1)
      : String(Math.max(0, currentLikes - 1));

  const updated = await updateStory({ id, patch: { likes: newLikes } });
  if (!updated) return null;

  return { storyId: id, likes: newLikes };
}
