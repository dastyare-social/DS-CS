import { sql } from "drizzle-orm";

import { db } from "@/lib/db";

import { embedTexts, embeddingsEnabled, toVectorLiteral } from "./embedder";

export interface KnowledgeHit {
  sourceType: "post";
  sourceId: string;
  content: string;
  score: number;
  createdAt?: string | null;
}

export type RetrievalMode = "keyword" | "semantic" | "hybrid";

export interface RetrievalResult {
  mode: RetrievalMode;
  hits: KnowledgeHit[];
  note?: string;
}

const EMBEDDING_TABLE = "agent_knowledge_embeddings";
const DEFAULT_LIMIT = 6;

/**
 * The pgvector table is created by `bun run rag:pgvector`, which is opt-in.
 * Cache the lookup per process: `to_regclass` is cheap, but retrieval runs on
 * every knowledge tool call.
 */
let embeddingTableCache: boolean | null = null;

export function resetRetrievalCaches() {
  embeddingTableCache = null;
}

async function hasEmbeddingTable(): Promise<boolean> {
  if (embeddingTableCache !== null) return embeddingTableCache;

  try {
    const result = await db.execute(
      sql`select to_regclass(${`public.${EMBEDDING_TABLE}`}) as table_name`,
    );
    embeddingTableCache =
      (result.rows[0] as { table_name?: string | null } | undefined)
        ?.table_name != null;
  } catch {
    embeddingTableCache = false;
  }

  return embeddingTableCache;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export async function keywordSearch(
  query: string,
  limit = DEFAULT_LIMIT,
): Promise<KnowledgeHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const result = await db.execute(sql`
    with query as (
      select websearch_to_tsquery('simple', ${trimmed}) as tsq
    )
    select
      p.id,
      p.content,
      p.created_at,
      ts_rank_cd(
        to_tsvector('simple', coalesce(p.content, '')),
        query.tsq
      ) as rank
    from posts p, query
    where to_tsvector('simple', coalesce(p.content, '')) @@ query.tsq
    order by rank desc, p.created_at desc
    limit ${limit}
  `);

  const rows = result.rows as Array<{
    id: string;
    content: string | null;
    created_at: Date | string | null;
    rank: number | string;
  }>;

  if (rows.length > 0) {
    return rows.map((row) => ({
      sourceType: "post" as const,
      sourceId: row.id,
      content: row.content ?? "",
      score: Number(row.rank) || 0,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : row.created_at,
    }));
  }

  // `websearch_to_tsquery` requires every term to match. A channel search is
  // more useful if a partial match still returns something, so fall back to a
  // substring scan before giving up.
  const fallback = await db.execute(sql`
    select p.id, p.content, p.created_at
    from posts p
    where p.content ilike ${`%${escapeLike(trimmed)}%`}
    order by p.created_at desc
    limit ${limit}
  `);

  return (
    fallback.rows as Array<{
      id: string;
      content: string | null;
      created_at: Date | string | null;
    }>
  ).map((row, index) => ({
    sourceType: "post" as const,
    sourceId: row.id,
    content: row.content ?? "",
    // Substring hits carry no rank; keep their order stable and clearly below
    // any real full-text match.
    score: 1 / (index + 1),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
  }));
}

export async function semanticSearch(
  query: string,
  limit = DEFAULT_LIMIT,
): Promise<KnowledgeHit[]> {
  const [vector] = await embedTexts([query]);
  if (!vector) return [];

  const literal = toVectorLiteral(vector);

  const result = await db.execute(sql`
    select
      source_id,
      content,
      1 - (embedding <=> ${literal}::vector) as score
    from ${sql.identifier(EMBEDDING_TABLE)}
    order by embedding <=> ${literal}::vector
    limit ${limit}
  `);

  return (
    result.rows as Array<{
      source_id: string;
      content: string;
      score: number | string;
    }>
  ).map((row) => ({
    sourceType: "post" as const,
    sourceId: row.source_id,
    content: row.content,
    score: Number(row.score) || 0,
  }));
}

function dedupe(hits: KnowledgeHit[], limit: number): KnowledgeHit[] {
  const seen = new Set<string>();
  const merged: KnowledgeHit[] = [];

  for (const hit of hits) {
    const key = `${hit.sourceId}:${hit.content.slice(0, 120)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(hit);
    if (merged.length >= limit) break;
  }

  return merged;
}

/**
 * Retrieval over the channel's own content.
 *
 * Default path is Postgres full-text search, which needs no extension and no
 * embedding provider. When embeddings are configured *and* the pgvector table
 * exists, results are a hybrid: semantic hits first, then keyword hits that
 * semantic search missed.
 */
export async function searchChannelKnowledge({
  query,
  limit = DEFAULT_LIMIT,
}: {
  query: string;
  limit?: number;
}): Promise<RetrievalResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { mode: "keyword", hits: [], note: "Empty query." };
  }

  const safeLimit = Math.min(20, Math.max(1, Math.round(limit)));

  const semanticAvailable =
    embeddingsEnabled() && (await hasEmbeddingTable());

  try {
    if (!semanticAvailable) {
      return {
        mode: "keyword",
        hits: await keywordSearch(trimmed, safeLimit),
      };
    }

    const [semantic, keyword] = await Promise.all([
      semanticSearch(trimmed, safeLimit).catch(() => []),
      keywordSearch(trimmed, safeLimit).catch(() => []),
    ]);

    return {
      mode: "hybrid",
      hits: dedupe([...semantic, ...keyword], safeLimit),
    };
  } catch (error) {
    return {
      mode: semanticAvailable ? "hybrid" : "keyword",
      hits: [],
      note:
        error instanceof Error
          ? `Retrieval failed: ${error.message}`
          : "Retrieval failed.",
    };
  }
}
