---
name: db-migration
description: Add or change a Postgres table, column or index in DS-CS with Drizzle, including the generated migration, the drizzle-zod schemas, and applying it. Use when adding a table, adding a column to posts/stories, changing an index, or when "column does not exist" appears at runtime. Not for reading data — that is the oRPC/REST layer.
---

# Database migrations

## The layout

| Path | Role |
|---|---|
| `src/lib/db/schema/*.ts` | Table definitions — one file per table |
| `src/lib/db/schema/index.ts` | Barrel export |
| `src/lib/db/migrations/` | Generated SQL, committed |
| `src/lib/db/migrate.ts` | Runtime migrator, used by the container on boot |
| `drizzle.config.ts` | Points drizzle-kit at `schema` and `migrations` |

Tables use `pgTable` with a `text` primary key (UUIDs are generated in application code, not by a database default), `jsonb` for structured columns, and a drizzle-zod schema exported alongside each one.

## Commands

```bash
bun run db:generate   # drizzle-kit generate → writes SQL into src/lib/db/migrations
bun run db:migrate    # apply pending migrations
bun run db:push       # push schema directly + seed (development shortcut)
bun run db:check      # verify migration history is consistent
bun run db:studio     # browse the database
```

`db:push` is a development shortcut that skips the migration files. **Never** use it as the way to ship a schema change — the container runs `db:migrate` on boot, so a change that exists only in the live database is a change that vanishes on the next deploy.

## Adding a table

1. Create `src/lib/db/schema/<name>.ts`:

```ts
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { toZodV4SchemaTyped } from "@/lib/zod-utils";

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: text("id").unique().primaryKey(),
    postId: text("post_id").notNull(),
    note: text("note"),
    tags: jsonb("tags"),
    createdAt: timestamp("created_at").$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => {
    return {
      bookmarksPostIdIdx: index("bookmarks_post_id_idx").on(table.postId),
    };
  }
);

export const selectBookmarksSchema = toZodV4SchemaTyped(createSelectSchema(bookmarks));

// Use pick() instead of omit() to avoid Zod v4 compatibility issues with createErrorSchema
export const insertBookmarksSchema = toZodV4SchemaTyped(
  createInsertSchema(bookmarks).pick({ postId: true, note: true, tags: true })
);

export const patchBookmarksSchema = insertBookmarksSchema.partial();
```

2. Export it from `src/lib/db/schema/index.ts`.
3. `bun run db:generate`, then review the generated SQL before applying.
4. `bun run db:migrate`.

## Adding a column

Edit the table in place, then `bun run db:generate`. drizzle-kit asks whether the change is safe; the answer matters:

- **Adding a column with a default or nullable** — safe, generates `ADD COLUMN`.
- **Adding a NOT NULL column without a default to a table that already has rows** — drizzle-kit will warn. Either add a default, or add it as nullable and backfill in a second migration. One migration that both adds and backfills leaves no window where the column is missing, but it also locks the table for the duration; on `posts` and `stories`, prefer two migrations.

Indexes are declared in the table's third argument with an explicit name (`postsCreatedAtIdx` → `posts_created_at_idx`). Name them consistently.

## Conventions that are already decided

- `id` is `text`, unique, primary key — generated in application code.
- Timestamps use `$defaultFn(() => new Date())` and `$onUpdate(() => new Date())`.
- `views` and `likes` are stored as `text` with a numeric string default, not `integer`. This is deliberate: they are display counters, and keeping them out of the numeric range avoids contention on hot rows. Read them with `Number(...)` and write them back as strings.
- Enum-ish columns are `text({ enum: [...] })`, not a Postgres enum type.
- Structured data is `jsonb`. It is not validated at the database level — the drizzle-zod schemas and the oRPC input schemas are where validation happens.

## Verify

```bash
bun run db:check
bun run db:migrate
bun run test
```

Confirm the migration folder contains the new SQL and that it is committed. A migration that exists only on your machine reproduces fine locally and fails for everyone else.

## Deploying

The container runs `bun run db:migrate` before serving. For Vercel Fluid, the build script runs `db:migrate` as well. Either way the migration files are what ships — if they are not committed, deploys silently skip the change.
