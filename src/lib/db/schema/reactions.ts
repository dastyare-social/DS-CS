import {
  pgTable,
  text,
  integer,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { posts } from "./posts";

export const reactions = pgTable(
  "reactions",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),

    emoji: text("emoji").notNull(),

    count: integer("count").notNull().default(0),

    createdAt: timestamp("created_at").$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.emoji] }),
  })
);

export const reactionsRelations = relations(reactions, ({ one }) => ({
  message: one(posts, {
    fields: [reactions.postId],
    references: [posts.id],
  }),
}));

export const selectReactionsSchema = createSelectSchema(reactions);
export const insertReactionsSchema = createInsertSchema(reactions);
