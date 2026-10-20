/**
 * Embeddings are opt-in.
 *
 * OpenRouter (the agent's model provider) does not serve embeddings, so the
 * semantic path uses any OpenAI-compatible embeddings endpoint: OpenAI itself,
 * a gateway, or a self-hosted server. Without a key the scaffold runs on
 * Postgres full-text search alone and never calls out.
 */

export interface EmbeddingConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  dimensions: number;
  /** Whether the request should send an explicit `dimensions` value. */
  sendDimensions: boolean;
}

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "text-embedding-3-small";
const DEFAULT_DIMENSIONS = 1_536;
const REQUEST_TIMEOUT_MS = 30_000;

export function embeddingConfig(): EmbeddingConfig | null {
  const apiKey =
    process.env.RAG_EMBEDDING_API_KEY?.trim() ??
    process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const rawDimensions = process.env.RAG_EMBEDDING_DIMENSIONS?.trim();
  const parsed = Number(rawDimensions);
  const dimensions =
    Number.isFinite(parsed) && parsed > 0
      ? Math.floor(parsed)
      : DEFAULT_DIMENSIONS;

  return {
    baseUrl: (process.env.RAG_EMBEDDING_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(
      /\/$/,
      "",
    ),
    apiKey,
    model: process.env.RAG_EMBEDDING_MODEL?.trim() || DEFAULT_MODEL,
    dimensions,
    sendDimensions: Boolean(rawDimensions),
  };
}

export function embeddingsEnabled(): boolean {
  return embeddingConfig() !== null;
}

interface EmbeddingResponse {
  data?: Array<{ embedding?: unknown; index?: unknown }>;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const config = embeddingConfig();
  if (!config) {
    throw new Error(
      "Embeddings are not configured. Set RAG_EMBEDDING_API_KEY (or OPENAI_API_KEY).",
    );
  }
  if (texts.length === 0) return [];

  const response = await fetch(`${config.baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      input: texts,
      ...(config.sendDimensions ? { dimensions: config.dimensions } : {}),
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Embedding request failed with ${response.status}`);
  }

  const payload = (await response.json()) as EmbeddingResponse;
  const rows = Array.isArray(payload.data) ? payload.data : [];

  return texts.map((_, index) => {
    const row = rows[index];
    const embedding = row?.embedding;
    if (!Array.isArray(embedding) || embedding.some((v) => typeof v !== "number")) {
      throw new Error("Embedding provider returned a malformed vector.");
    }
    return embedding as number[];
  });
}

export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
