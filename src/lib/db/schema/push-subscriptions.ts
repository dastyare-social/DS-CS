import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { toZodV4SchemaTyped } from "@/lib/zod-utils";

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: text("id").unique().primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const selectPushSubscriptionsSchema = toZodV4SchemaTyped(
  createSelectSchema(pushSubscriptions),
);

export const insertPushSubscriptionsSchema = toZodV4SchemaTyped(
  createInsertSchema(pushSubscriptions).pick({
    endpoint: true,
    p256dh: true,
    auth: true,
    userAgent: true,
    active: true,
  }),
);

export const patchPushSubscriptionsSchema = insertPushSubscriptionsSchema.partial();
