import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema/stories";

export type StoryType = "image" | "video";

export type StoryImageMedia = {
  url: string;
  thumbnail?: string;
  width: number;
  height: number;
  caption?: string;
};

export type StoryVideoMedia = {
  url: string;
  thumbnail?: string;
  duration: number;
  width: number;
  height: number;
  caption?: string;
};

export type StoryMediaPayload = StoryImageMedia | StoryVideoMedia | null;

export type StoryItem = {
  id: string;
  type: StoryType;
  views: string;
  likes: string;
  media: any;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type GetStoriesParams = {
  page?: number;
  limit?: number;
  search?: string;
  type?: StoryType;
};

export async function getStories({
  page = 1,
  limit = 20,
  search,
  type,
}: GetStoriesParams): Promise<{
  items: StoryItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}> {
  const offset = (page - 1) * limit;

  const where = (() => {
    const conditions: any[] = [];

    if (search) {
      conditions.push(
        ilike(
          // @ts-ignore
          sql`(stories.media ->> 'caption')`,
          `%${search}%`
        )
      );
    }

    if (type) {
      conditions.push(eq(stories.type, type));
    }

    if (conditions.length === 0) return undefined;
    if (conditions.length === 1) return conditions[0];
    return and(...conditions);
  })();

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(stories)
      .where(where)
      .orderBy(desc(stories.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: sql<number>`count(*)` })
      .from(stories)
      .where(where),
  ]);

  const total = Number(totalRows[0]?.value || 0);
  const hasMore = page * limit < total;

  const items: StoryItem[] = rows.map((story) => ({
    ...story,
  }));

  return { items, page, limit, total, hasMore };
}

export async function countStories(): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)` })
    .from(stories);
  return Number(row?.value || 0);
}

export async function getStoryById(id: string): Promise<StoryItem | null> {
  const [row] = await db.select().from(stories).where(eq(stories.id, id));
  if (!row) return null;
  return { ...row };
}
