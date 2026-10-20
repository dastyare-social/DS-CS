import { PostgresStore } from "@mastra/pg";

/**
 * One Postgres store per process, shared by Mastra's own storage (traces,
 * threads) and agent memory. Two stores would open two pools against the same
 * database for no benefit.
 */
let store: PostgresStore | undefined;

export function mastraStorage(): PostgresStore | undefined {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return undefined;

  if (!store) {
    store = new PostgresStore({
      id: "ds-cs-mastra",
      connectionString,
    });
  }

  return store;
}

/** Test hook: drop the cached store so a test can rebuild it. */
export function resetMastraStorage() {
  store = undefined;
}
