import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { toZodV4SchemaTyped } from "@/lib/zod-utils";

export const subscribers = pgTable("subscribers", {
  id: text("id").unique().primaryKey(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const selectSubscribersSchema = toZodV4SchemaTyped(
  createSelectSchema(subscribers),
);

// Use pick() instead of omit() to avoid Zod v4 compatibility issues with createErrorSchema
export const insertSubscribersSchema = toZodV4SchemaTyped(
  createInsertSchema(subscribers).pick({
    firstName: true,
    lastName: true,
    email: true,
  }),
);

export const patchSubscribersSchema = insertSubscribersSchema.partial();
