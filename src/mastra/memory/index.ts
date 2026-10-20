import { Memory } from "@mastra/memory";

import { mastraStorage } from "../storage";

/**
 * Working memory is the small, structured slice the agent should always see:
 * who the channel is, how it sounds, and what the operator has decided. It is
 * not a transcript — `lastMessages` covers that.
 */
export const ZERNIO_WORKING_MEMORY_TEMPLATE = `# Zernio working memory

## Channel
- name:
- what it publishes:
- primary language:

## Voice
- tone:
- words to avoid:
- emoji policy:

## Publishing defaults
- connected accounts:
- preferred posting times:
- hashtag policy:

## Standing instructions
- things the operator never wants published:
`;

let memory: Memory | undefined;

/**
 * Thread-scoped conversation memory, backed by the same Postgres store as the
 * rest of Mastra. `resourceId` is always the signed-in user id, so one user's
 * threads can never be listed by another.
 *
 * Semantic recall is off: it would need an embeddings provider for *messages*
 * as well as for channel content, and the cheap win here is the transcript.
 * `search_channel` covers retrieval over published posts.
 */
export function zernioMemory(): Memory | undefined {
  const storage = mastraStorage();
  if (!storage) return undefined;

  if (!memory) {
    memory = new Memory({
      storage,
      options: {
        lastMessages: 20,
        semanticRecall: false,
        workingMemory: {
          enabled: true,
          template: ZERNIO_WORKING_MEMORY_TEMPLATE,
        },
      },
    });
  }

  return memory;
}

/**
 * The `memory` option every agent call should pass. Keeping the pairing in one
 * helper is what stops a call site from forgetting `resource` and writing one
 * user's thread into the anonymous bucket.
 */
export function zernioMemoryContext(userId: string, threadId: string) {
  if (!userId) throw new Error("zernioMemoryContext requires a userId");
  if (!threadId) throw new Error("zernioMemoryContext requires a threadId");

  return { thread: threadId, resource: userId };
}

/** Test hook: drop the cached instance so a test can rebuild it. */
export function resetZernioMemory() {
  memory = undefined;
}
