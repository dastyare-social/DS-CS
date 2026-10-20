import { MCPOAuthClientProvider } from "@mastra/mcp";

import { PostgresOAuthStorage } from "@/lib/agents/oauth-storage";

export const ZERNIO_MCP_SERVER_NAME = "zernio";

export const ZERNIO_OAUTH_CALLBACK_PATH = "/api/agents/zernio/callback";

export const ZERNIO_MCP_URL =
  process.env.ZERNIO_MCP_URL ?? "https://mcp.zernio.com/mcp";

/**
 * Zernio hosts the MCP server itself (`mcp.zernio.com`) and the authorization
 * server (`zernio.com`); `allowedHosts` must include both because Mastra also
 * validates OAuth discovery and token requests.
 */
export const ZERNIO_ALLOWED_HOSTS = ["mcp.zernio.com", "zernio.com"];

export function zernioRedirectUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:8729";

  return new URL(ZERNIO_OAUTH_CALLBACK_PATH, base).toString();
}

export function isZernioOAuthConfigured(): boolean {
  return Boolean(
    process.env.ZERNIO_CLIENT_METADATA_URL ?? process.env.ZERNIO_CLIENT_ID,
  );
}

interface CreateZernioAuthProviderOptions {
  userId: string;
  onRedirectToAuthorization?: (url: URL) => void | Promise<void>;
}

/**
 * Builds a provider scoped to a single user.
 *
 * Mastra never performs dynamic client registration. Zernio must therefore be
 * given either:
 *   - `ZERNIO_CLIENT_METADATA_URL`: an HTTPS Client ID Metadata Document that
 *     Zernio fetches (the URL becomes the `client_id`), or
 *   - `ZERNIO_CLIENT_ID` / `ZERNIO_CLIENT_SECRET`: a client pre-registered with
 *     Zernio whose redirect URI is `zernioRedirectUrl()`.
 *
 * Exactly one identity source may be configured.
 */
export function createZernioAuthProvider({
  userId,
  onRedirectToAuthorization,
}: CreateZernioAuthProviderOptions): MCPOAuthClientProvider {
  const redirectUrl = zernioRedirectUrl();
  const clientMetadataUrl = process.env.ZERNIO_CLIENT_METADATA_URL;
  const clientId = process.env.ZERNIO_CLIENT_ID;
  const scope = process.env.ZERNIO_SCOPES;

  if (clientMetadataUrl && clientId) {
    throw new Error(
      "Configure either ZERNIO_CLIENT_METADATA_URL or ZERNIO_CLIENT_ID, not both.",
    );
  }

  const clientMetadata = {
    redirect_uris: [redirectUrl],
    client_name: "Dastyare Social",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    ...(scope ? { scope } : {}),
  };

  const common = {
    redirectUrl,
    clientMetadata,
    storage: new PostgresOAuthStorage(userId, ZERNIO_MCP_SERVER_NAME),
    onRedirectToAuthorization,
  };

  if (clientMetadataUrl) {
    return new MCPOAuthClientProvider({
      ...common,
      clientMetadataUrl,
    });
  }

  if (clientId) {
    return new MCPOAuthClientProvider({
      ...common,
      clientInformation: {
        client_id: clientId,
        ...(process.env.ZERNIO_CLIENT_SECRET
          ? { client_secret: process.env.ZERNIO_CLIENT_SECRET }
          : {}),
      },
    });
  }

  throw new Error(
    "Zernio OAuth is not configured. Set ZERNIO_CLIENT_METADATA_URL (CIMD) or ZERNIO_CLIENT_ID (pre-registered client).",
  );
}
