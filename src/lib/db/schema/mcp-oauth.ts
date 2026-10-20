import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Persistent key/value store for MCP OAuth client state.
 *
 * `MCPOAuthClientProvider` keeps access tokens, refresh tokens, the PKCE
 * verifier and the authorization-server discovery document under opaque
 * string keys. Rows are namespaced by user *and* MCP server so one user's
 * credentials can never be read by another user or reused against a
 * different authorization server.
 *
 * Values are encrypted before they reach this table by
 * `src/lib/agents/oauth-storage.ts`.
 */
export const mcpOAuthStorage = pgTable(
  "mcp_oauth_storage",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    server: text("server").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("mcp_oauth_storage_user_server_key_idx").on(
      table.userId,
      table.server,
      table.key,
    ),
    index("mcp_oauth_storage_user_idx").on(table.userId),
  ],
);
