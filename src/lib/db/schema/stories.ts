import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { toZodV4SchemaTyped } from "@/lib/zod-utils";

export const stories = pgTable("stories", {
  id: text("id").unique().primaryKey(),
  type: text({
    enum: ["image", "video"],
  })
    .notNull()
    .default("image"),
  views: text("views").notNull().default("0"),
  likes: text("likes").notNull().default("0"),
  media: jsonb("media"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const selectStoriesSchema = toZodV4SchemaTyped(
  createSelectSchema(stories)
);

// Use pick() instead of omit() to avoid Zod v4 compatibility issues with createErrorSchema
export const insertStoriesSchema = toZodV4SchemaTyped(
  createInsertSchema(stories).pick({
    type: true,
    views: true,
    likes: true,
    media: true,
  })
);

export const patchStoriesSchema = insertStoriesSchema.partial();
