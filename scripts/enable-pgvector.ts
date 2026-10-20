import "dotenv/config";

import { Pool } from "pg";

/**
 * Opt-in semantic retrieval.
 *
 * Stock Postgres (including the `postgres:16` image this repo ships) has no
 * pgvector, so this runs only when the operator asks for it:
 *
 *   bun run rag:pgvector
 *
 * It is idempotent: safe to re-run after changing the embedding dimension.
 * Changing the dimension of an existing table is refused rather than silently
 * dropping vectors — delete the table first if the model changed.
 */

function dimension(): number {
  const raw = Number(process.env.RAG_EMBEDDING_DIMENSIONS ?? 1536);
  if (!Number.isFinite(raw) || raw <= 0 || raw > 8192) {
    throw new Error(
      `RAG_EMBEDDING_DIMENSIONS must be a positive integer up to 8192, got "${process.env.RAG_EMBEDDING_DIMENSIONS}".`,
    );
  }
  return Math.floor(raw);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const dims = dimension();
  const pool = new Pool({ connectionString });

  try {
    await pool.query("create extension if not exists vector");

    const existing = await pool.query<{ atttypmod: number }>(
      `select atttypmod
         from pg_attribute
        where attrelid = to_regclass('public.agent_knowledge_embeddings')
          and attname = 'embedding'`,
    );

    if (existing.rows.length > 0) {
      // pgvector stores the dimension in atttypmod (dimension + 4).
      const current = existing.rows[0].atttypmod - 4;
      if (current !== dims) {
        throw new Error(
          `agent_knowledge_embeddings already stores ${current}-dimension vectors, but RAG_EMBEDDING_DIMENSIONS is ${dims}. Drop the table and re-index after changing the model.`,
        );
      }
    }

    await pool.query(`
      create table if not exists agent_knowledge_embeddings (
        id text primary key,
        source_type text not null,
        source_id text not null,
        chunk_index integer not null,
        content text not null,
        embedding vector(${dims}) not null,
        model text not null,
        updated_at timestamptz not null default now()
      )
    `);

    await pool.query(`
      create unique index if not exists agent_knowledge_embeddings_source_chunk_idx
        on agent_knowledge_embeddings (source_type, source_id, chunk_index)
    `);

    // HNSW is the right default here: the corpus is small enough that index
    // build time is irrelevant, and query latency is what matters.
    await pool.query(`
      create index if not exists agent_knowledge_embeddings_vector_idx
        on agent_knowledge_embeddings using hnsw (embedding vector_cosine_ops)
    `);

    console.log(
      `pgvector ready: agent_knowledge_embeddings (${dims} dimensions). Run \`bun run rag:index\` to embed existing posts.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
