import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { OAuthStorage } from "@mastra/mcp";

import { db } from "@/lib/db";
import { mcpOAuthStorage } from "@/lib/db/schema";

const ENVELOPE_PREFIX = "v1.";

/**
 * OAuth material (access tokens, refresh tokens, PKCE verifiers) is encrypted
 * at rest with AES-256-GCM. `MCP_OAUTH_ENCRYPTION_KEY` is preferred; falling
 * back to `BETTER_AUTH_SECRET` keeps existing installs working without a new
 * mandatory secret. Rotating the key invalidates stored connections, which is
 * the intended failure mode — the user re-authorizes.
 */
function encryptionKey(): Buffer {
  const secret =
    process.env.MCP_OAUTH_ENCRYPTION_KEY ?? process.env.BETTER_AUTH_SECRET;

  if (!secret) {
    throw new Error(
      "Cannot store Zernio OAuth credentials: set MCP_OAUTH_ENCRYPTION_KEY or BETTER_AUTH_SECRET.",
    );
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptOAuthValue(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    ENVELOPE_PREFIX.slice(0, -1),
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptOAuthValue(stored: string): string {
  if (!stored.startsWith(ENVELOPE_PREFIX)) {
    // Tolerate plaintext rows written by an earlier scaffold.
    return stored;
  }

  const [, iv, tag, ciphertext] = stored.split(".");
  if (!iv || !tag || !ciphertext) {
    throw new Error("Malformed encrypted OAuth value");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * `OAuthStorage` implementation for one user × one MCP server.
 *
 * Mastra keys tokens by the authorization server's issuer, but it coordinates
 * writes only within a single provider instance. A storage instance per
 * user/server pair gives every provider its own namespace, as the MCP
 * authorization spec requires.
 */
export class PostgresOAuthStorage implements OAuthStorage {
  constructor(
    private readonly userId: string,
    private readonly server: string,
  ) {}

  async set(key: string, value: string): Promise<void> {
    await db
      .insert(mcpOAuthStorage)
      .values({
        id: randomUUID(),
        userId: this.userId,
        server: this.server,
        key,
        value: encryptOAuthValue(value),
      })
      .onConflictDoUpdate({
        target: [
          mcpOAuthStorage.userId,
          mcpOAuthStorage.server,
          mcpOAuthStorage.key,
        ],
        set: {
          value: encryptOAuthValue(value),
          updatedAt: new Date(),
        },
      });
  }

  async get(key: string): Promise<string | undefined> {
    const [row] = await db
      .select({ value: mcpOAuthStorage.value })
      .from(mcpOAuthStorage)
      .where(
        and(
          eq(mcpOAuthStorage.userId, this.userId),
          eq(mcpOAuthStorage.server, this.server),
          eq(mcpOAuthStorage.key, key),
        ),
      )
      .limit(1);

    return row ? decryptOAuthValue(row.value) : undefined;
  }

  async delete(key: string): Promise<void> {
    await db
      .delete(mcpOAuthStorage)
      .where(
        and(
          eq(mcpOAuthStorage.userId, this.userId),
          eq(mcpOAuthStorage.server, this.server),
          eq(mcpOAuthStorage.key, key),
        ),
      );
  }
}
