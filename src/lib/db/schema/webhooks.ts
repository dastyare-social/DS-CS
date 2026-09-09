import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { toZodV4SchemaTyped } from "@/lib/zod-utils";

export const webhooks = pgTable("webhooks", {
  id: text("id").unique().primaryKey(),
  url: text("url").notNull(),
  events: text("events").array().notNull(),
  secret: text("secret").notNull(),
  active: boolean("active").default(true).notNull(),
  lastStatus: text("last_status"),
  lastAttemptAt: timestamp("last_attempt_at"),
  failureCount: integer("failure_count").default(0).notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const selectWebhooksSchema = toZodV4SchemaTyped(
  createSelectSchema(webhooks),
);

export const insertWebhooksSchema = toZodV4SchemaTyped(
  createInsertSchema(webhooks).pick({
    url: true,
    events: true,
    secret: true,
    active: true,
  }),
);

export const patchWebhooksSchema = insertWebhooksSchema.partial();