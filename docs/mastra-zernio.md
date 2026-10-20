# Mastra + Zernio (scaffold)

The v1.0.0 scaffold adds a [Mastra](https://mastra.ai) agent runtime and connects
it to [Zernio](https://zernio.com)'s hosted MCP server. It ships **without UI**:
no chat surface is mounted, and no agent HTTP route is registered yet.

## What is in the tree

| Path | Purpose |
|---|---|
| `src/mastra/index.ts` | `Mastra` instance — registers the Zernio agent and Postgres storage |
| `src/mastra/agents/zernio.ts` | Agent definition, OpenRouter model, Zernio skills |
| `src/mastra/mcp/zernio.ts` | Per-user `MCPClient` factory for `https://mcp.zernio.com/mcp` |
| `src/mastra/oauth/zernio-provider.ts` | `MCPOAuthClientProvider` configuration and redirect URL |
| `src/mastra/skills.ts` | The six vendored Zernio skills, as filesystem paths |
| `src/lib/agents/oauth-storage.ts` | `OAuthStorage` backed by Postgres, encrypted at rest |
| `src/lib/db/schema/mcp-oauth.ts` | `mcp_oauth_storage` table |
| `src/app/api/agents/zernio/authorize/route.ts` | Starts OAuth for the signed-in user |
| `src/app/api/agents/zernio/callback/route.ts` | Hosted OAuth callback (code + PKCE exchange) |
| `skills/zernio/*/SKILL.md` | The same skills, installed in the DS-CS registry |

## Environment

```bash
OPENROUTER_API_KEY=...
MASTRA_MODEL="openrouter/anthropic/claude-sonnet-4.5"

ZERNIO_MCP_URL="https://mcp.zernio.com/mcp"

# Choose ONE client identity (Mastra never uses dynamic client registration):
ZERNIO_CLIENT_METADATA_URL="https://your-domain.com/api/agents/zernio/client-metadata"
# or
ZERNIO_CLIENT_ID=...
ZERNIO_CLIENT_SECRET=...

MCP_OAUTH_ENCRYPTION_KEY=...   # optional; falls back to BETTER_AUTH_SECRET
```

The OAuth redirect URI to register with Zernio is:

```
{NEXT_PUBLIC_APP_URL}/api/agents/zernio/callback
```

### Why a pre-registered client or CIMD?

`MCPOAuthClientProvider` deliberately does not perform dynamic client
registration. Zernio advertises a registration endpoint, but Mastra will not call
it. Configure either:

- **CIMD** (`ZERNIO_CLIENT_METADATA_URL`) — an HTTPS, non-root-path document
  containing the same `client_id` (the URL), `client_name` and `redirect_uris`.
  Zernio fetches it during authorization.
- **Pre-registered client** (`ZERNIO_CLIENT_ID` / `ZERNIO_CLIENT_SECRET`) — the
  redirect URI above must be registered exactly.

## OAuth flow

1. A signed-in user hits `GET /api/agents/zernio/authorize`.
2. The route pins a `state` (`beginAuthorizationSession`), stores it in an
   httpOnly cookie scoped to `/api/agents/zernio`, and triggers discovery with
   `client.listTools()`.
3. Zernio rejects the connection with `401`, the provider emits the
   authorization URL, and the route redirects the browser to it. The SDK has
   already persisted the PKCE verifier and discovery state through
   `PostgresOAuthStorage`.
4. Zernio redirects back to `GET /api/agents/zernio/callback`. The route checks
   the state cookie, confirms the Better Auth session matches, then calls the
   MCP SDK's `auth()` with the code. The provider exchanges it using the stored
   verifier and binds the resulting tokens to Zernio's issuer.
5. Tokens land in `mcp_oauth_storage`, namespaced by user and server.

Mastra's interactive `authenticate()` helper is not used: it only handles
loopback (`http://127.0.0.1`) callbacks, while this app has an HTTPS callback.

## Storage and encryption

`mcp_oauth_storage` is a key/value table unique on
`(user_id, server, key)`. Values are AES-256-GCM encrypted in
`src/lib/agents/oauth-storage.ts` before insert. Rotating the encryption key
invalidates existing connections; affected users re-authorize.

## Skills

The six Zernio skills are vendored verbatim (plus Agent Skills frontmatter) from
`https://zernio.com/.well-known/agent-skills/`:

`schedule-post`, `connect-account`, `list-analytics`, `send-message`, `run-ads`,
`manage-blog-articles`.

They live under `skills/zernio/` so `ds-cs add` sees them, and
`src/mastra/skills.ts` points the agent at the same directories. Do not copy
them a second time.

## Attaching tools later

Tools cannot be attached at module scope because credentials are per user:

```ts
import { createZernioMcpClient } from "@/mastra/mcp/zernio";

const { client } = createZernioMcpClient({ userId });
const tools = await client.listTools(); // namespaced zernio_*
// pass to an agent run, then:
await client.disconnect();
```

`forwardInstructions` is intentionally `false` until Zernio's server
instructions have been reviewed — they are injected into the system prompt.

## Deployment notes

- `skills/` must be present in the runtime image at `process.cwd()/skills`;
  Mastra's `LocalSkillSource` reads from disk.
- `src/mastra/index.ts` only constructs `PostgresStore` when `DATABASE_URL` is
  set, so importing the module in a credential-less environment does not throw.
- The scaffold does not add the `mastra` CLI. Add it when local Studio work
  starts.
