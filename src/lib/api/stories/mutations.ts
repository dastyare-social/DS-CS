import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema/stories";
import {
  insertStoriesSchema,
  patchStoriesSchema,
} from "@/lib/db/schema/stories";
import { z } from "zod";
import { randomUUID } from "crypto";
import type {
  StoryItem,
  StoryMediaPayload,
  StoryType,
} from "./queries";
import { getStoryById } from "./queries";
import { app_config } from "@/config/app";
import { sendPushNotification } from "@/lib/notifications/push";
import { captureServerEvent, flushServerEvents } from "@/lib/analytics/server";
import { getMediaDimensionsFromUrl } from "@/lib/utils/media";
import { assertWritable } from "@/lib/demo-mode";

export function inferStoryTypeFromUrl(url: string): StoryType {
  const lowerUrl = url.toLowerCase();
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
  const videoExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];

  for (const ext of videoExts) {
    if (lowerUrl.endsWith(ext)) return "video";
  }
  for (const ext of imageExts) {
    if (lowerUrl.endsWith(ext)) return "image";
  }
  return "image";
}

export async function buildStoryMediaFromUrl(
  url: string,
  type: StoryType,
  dimensions?: { width: number; height: number; duration?: number }
): Promise<StoryMediaPayload> {
  switch (type) {
    case "image": {
      return {
        url,
        width: dimensions?.width || 0,
        height: dimensions?.height || 0,
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
    default:
      return null;
  }
}

export type StoryMediaInput = {
  url: string;
  type?: StoryType | null;
  width?: number;
  height?: number;
  duration?: number;
  thumbnail?: string;
  caption?: string;
};

type CreateStoryInput = {
  type?: StoryType | null;
  views?: string | null;
  likes?: string | null;
  media?: StoryMediaInput | StoryMediaInput[] | null;
};

async function buildStoryMediaForInput(input: StoryMediaInput): Promise<{
  type: StoryType;
  media: StoryMediaPayload;
}> {
  const type = input.type || inferStoryTypeFromUrl(input.url);

  let dimensions: { width: number; height: number; duration?: number } = {
    width: input.width || 0,
    height: input.height || 0,
    duration: input.duration,
  };

  if (!dimensions.width && !dimensions.height) {
    if (type === "image" || type === "video") {
      dimensions = await getMediaDimensionsFromUrl(input.url, type);
    }
  }

  const built =
    (await buildStoryMediaFromUrl(input.url, type, dimensions)) ?? {
      url: input.url,
      width: 0,
      height: 0,
      duration: 0,
    };

  const media = { ...built };
  if (input.thumbnail) {
    media.thumbnail = input.thumbnail;
  }
  if (input.caption) {
    media.caption = input.caption;
  }

  return { type, media };
}

async function insertStory({
  type,
  views,
  likes,
  media,
  push,
}: {
  type: StoryType;
  views?: string | null;
  likes?: string | null;
  media: StoryMediaPayload | null;
  push: boolean;
}): Promise<StoryItem> {
  const now = new Date();

  const parsedBase = insertStoriesSchema.parse({
    type,
    views: views ?? "0",
    likes: likes ?? "0",
    media,
  });

  const toInsert = {
    id: randomUUID(),
    ...parsedBase,
    createdAt: now,
    updatedAt: now,
  };

  const [inserted] = await db.insert(stories).values(toInsert).returning();

  if (inserted) {
    await captureServerEvent("story_created", {
      story_id: inserted.id,
      story_type: type,
      has_media: Boolean(media),
      views: inserted.views,
      likes: inserted.likes,
    });
    await flushServerEvents();

    if (push) {
      await sendPushNotification({
        title: "New Story",
        body: "A new story is now live",
        url: "/",
      });
    }
  }

  return {
    ...inserted,
  };
}

export async function createStory({
  type,
  views,
  likes,
  media,
}: CreateStoryInput): Promise<StoryItem> {
  assertWritable();
  const items = media ? (Array.isArray(media) ? media : [media]) : [];

  if (items.length === 0) {
    return insertStory({
      type: type ?? "image",
      views,
      likes,
      media: null,
      push: true,
    });
  }

  if (items.length === 1) {
    const { type: itemType, media: itemMedia } =
      await buildStoryMediaForInput(items[0]);
    return insertStory({
      type: itemType,
      views,
      likes,
      media: itemMedia,
      push: true,
    });
  }

  const createdStories: StoryItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const { type: itemType, media: itemMedia } =
      await buildStoryMediaForInput(items[i]);
    const created = await insertStory({
      type: itemType,
      views,
      likes,
      media: itemMedia,
      push: i === 0,
    });
    createdStories.push(created);
  }

  return createdStories[0];
}

type UpdateStoryInput = {
  id: string;
  patch: z.infer<typeof patchStoriesSchema>;
};

async function updateStoryInternal({
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
  await captureServerEvent("story_updated", {
    story_id: id,
    updated_fields: Object.keys(parsed),
    story_type: updated.type,
  });
  await flushServerEvents();
  return {
    ...updated,
  };
}

export async function updateStory({
  id,
  patch,
}: UpdateStoryInput): Promise<StoryItem | null> {
  assertWritable();
  return updateStoryInternal({ id, patch });
}

export async function deleteStoryById(id: string): Promise<boolean> {
  assertWritable();
  const res = await db
    .delete(stories)
    .where(eq(stories.id, id))
    .returning({ id: stories.id });
  const success = res.length > 0;
  if (success) {
    await captureServerEvent("story_deleted", {
      story_id: id,
    });
    await flushServerEvents();
  }
  return success;
}

export async function incrementStoryViews(
  id: string
): Promise<{ storyId: string; views: string } | null> {
  const existing = await getStoryById(id);
  if (!existing) return null;

  const currentViews = Number(existing.views || "0");
  const newViews = String(currentViews + 1);

  const updated = await updateStoryInternal({ id, patch: { views: newViews } });
  if (!updated) return null;

  await captureServerEvent("story_viewed", {
    story_id: id,
    views: newViews,
  });
  await flushServerEvents();

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

  const updated = await updateStoryInternal({ id, patch: { likes: newLikes } });
  if (!updated) return null;

  await captureServerEvent("story_liked", {
    story_id: id,
    direction,
    likes: newLikes,
  });
  await flushServerEvents();

  return { storyId: id, likes: newLikes };
}
