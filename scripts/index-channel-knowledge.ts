import "dotenv/config";

import { sql } from "drizzle-orm";

import { db } from "../src/lib/db";
import { posts } from "../src/lib/db/schema";
import {
  embedTexts,
  embeddingConfig,
  toVectorLiteral,
} from "../src/mastra/rag/embedder";
import { chunkText } from "../src/mastra/rag/chunk";

/**
 * Embeds published posts into the pgvector table created by
 * `bun run rag:pgvector`.
 *
 * Idempotent per source: chunks are upserted on
 * (source_type, source_id, chunk_index), and stale chunks from a longer
 * previous version of the post are removed.
 *
 * Usage:
 *   bun run rag:index              # all posts
 *   bun run rag:index -- --limit 50
 */

const BATCH_SIZE = 16;

function readLimit(): number | undefined {
  const index = process.argv.indexOf("--limit");
  if (index === -1) return undefined;
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

async function main() {
  const config = embeddingConfig();
  if (!config) {
    throw new Error(
      "Embeddings are not configured. Set RAG_EMBEDDING_API_KEY (or OPENAI_API_KEY), then run `bun run rag:pgvector` first.",
    );
  }

  const limit = readLimit();
  const rows = await db
    .select({ id: posts.id, content: posts.content })
    .from(posts)
    .orderBy(posts.createdAt);

  const selected = limit ? rows.slice(-limit) : rows;
  let chunksWritten = 0;
  let postsIndexed = 0;

  for (const post of selected) {
    const chunks = chunkText(post.content ?? "");
    if (chunks.length === 0) continue;

    for (let start = 0; start < chunks.length; start += BATCH_SIZE) {
      const batch = chunks.slice(start, start + BATCH_SIZE);
      const vectors = await embedTexts(batch.map((chunk) => chunk.content));

      for (const [offset, chunk] of batch.entries()) {
        const vector = vectors[offset];
        const id = `${post.id}:${chunk.index}`;

        await db.execute(sql`
          insert into agent_knowledge_embeddings
            (id, source_type, source_id, chunk_index, content, embedding, model, updated_at)
          values
            (${id}, 'post', ${post.id}, ${chunk.index}, ${chunk.content},
             ${toVectorLiteral(vector)}::vector, ${config.model}, now())
          on conflict (source_type, source_id, chunk_index) do update set
            content = excluded.content,
            embedding = excluded.embedding,
            model = excluded.model,
            updated_at = now()
        `);

        chunksWritten += 1;
      }
    }

    await db.execute(sql`
      delete from agent_knowledge_embeddings
       where source_type = 'post'
         and source_id = ${post.id}
         and chunk_index >= ${chunks.length}
    `);

    postsIndexed += 1;
    process.stdout.write(`\rindexed ${postsIndexed}/${selected.length} posts`);
  }

  process.stdout.write("\n");
  console.log(
    `Done: ${postsIndexed} posts, ${chunksWritten} chunks embedded with ${config.model} (${config.dimensions}d).`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
