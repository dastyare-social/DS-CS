import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { toZodV4SchemaTyped } from "@/lib/zod-utils";

export const posts = pgTable("posts", {
  id: text("id").unique().primaryKey(),
  type: text({
    enum: ["text", "image", "video", "voice", "file"],
  })
    .notNull()
    .default("text"),
  content: text("content"),
  views: text("views")
    .notNull()
    .default("0"),
  pinnedAt: timestamp("pinned_at"),
  media: jsonb("media"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
}, (table) => {
  return {
    postsCreatedAtIdx: index("posts_created_at_idx").on(table.createdAt),
    postsTypeIdx: index("posts_type_idx").on(table.type),
  };
});

export const selectPostsSchema = toZodV4SchemaTyped(
  createSelectSchema(posts),
);

// Use pick() instead of omit() to avoid Zod v4 compatibility issues with createErrorSchema
export const insertPostsSchema = toZodV4SchemaTyped(
  createInsertSchema(posts).pick({
    type: true,
    content: true,
    views: true,
    pinnedAt: true,
    media: true,
  }),
);

export const patchPostsSchema = insertPostsSchema.partial();
