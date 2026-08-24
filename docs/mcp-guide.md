# MCP Guide — Dastyare Social CS

A complete guide to connecting AI agents to your creator studio via the Model Context Protocol (MCP).

> [!WARNING]
> **SEO & LLM discovery is experimental.** MCP tool discovery and agent-facing endpoints follow current best practices, but whether AI assistants discover, cite, or surface your content can't be fully relied on.

---

## What is MCP and why should I care?

MCP is a standard protocol that lets AI assistants (Claude, ChatGPT, Cursor, Windsurf, etc.) call your app's features as **tools** — not by guessing URLs, but by discovering and invoking named functions with typed parameters.

**Without MCP**, an AI agent has to figure out your API by reading docs, guessing endpoints, and constructing HTTP requests. It works, but it's fragile and the agent often gets it wrong.

**With MCP**, the AI agent asks your server "what tools do you have?", gets a structured list, and calls them directly. It knows the exact parameter names, types, and descriptions. No guessing.

### When MCP helps

| Situation | Without MCP | With MCP |
|-----------|-------------|----------|
| "What posts do I have?" | Agent constructs `GET /api/posts?page=1` and hopes | Agent calls `list_posts` with typed params |
| "Create a post about X" | Agent has to figure out auth headers, body format, content type | Agent calls `create_post` — your server enforces auth |
| "How many stories?" | Agent hits `/api/stories?type=count`, parses the response | Agent calls `count_stories`, gets a clean number |
| "Delete post ABC" | Agent sends `DELETE /api/posts/ABC` — risky if it guesses wrong | Agent calls `delete_post` with the exact ID from a prior `list_posts` call |

### Who should use MCP

- **You** — if you want to manage your content from Claude Desktop, Cursor, or any MCP-compatible client instead of the web UI
- **Your users' AI agents** — if you want external agents to discover and interact with your public content
- **Developers building on your platform** — MCP gives them a typed, documented interface instead of raw HTTP

---

## Two ways to connect

### Remote (HTTP) — recommended for most users

The app runs an MCP server at `https://<your-domain>/api/mcp`. Any MCP client can connect to it over the network. No local process needed.

### Local (stdio) — for development and power users

Run `bun run mcp` to start a stdio MCP server that talks directly to your database. Faster, works offline, but requires the repo cloned locally.

---

## Quick setup

### Claude Desktop

**Remote (HTTP):**

1. Open Claude Desktop → Settings → Developer → Edit Config
2. Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ds-cs": {
      "url": "https://cs.dastyare.social/api/mcp"
    }
  }
}
```

3. Restart Claude Desktop. You'll see "dastyare" in the MCP section.

**With write access** (create/edit/delete posts):

```json
{
  "mcpServers": {
    "ds-cs": {
      "url": "https://cs.dastyare.social/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

**Local (stdio):**

```json
{
  "mcpServers": {
    "ds-cs": {
      "command": "bun",
      "args": ["run", "mcp"],
      "cwd": "/path/to/dastyare_social_cs"
    }
  }
}
```

### Cursor

1. Open Cursor → Settings → MCP
2. Click "Add new global MCP server"
3. Paste the same JSON config as above

Or create `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "ds-cs": {
      "url": "https://cs.dastyare.social/api/mcp"
    }
  }
}
```

### Windsurf

1. Open Windsurf → Settings → MCP
2. Add server with the same config

### Claude Code (CLI)

The repo already includes `.mcp.json` at the root. Claude Code auto-discovers it when you open the project. For remote access, create `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "ds-cs": {
      "type": "url",
      "url": "https://cs.dastyare.social/api/mcp"
    }
  }
}
```

### Any MCP client (generic)

Point your client at the discovery endpoint to verify it works:

```bash
curl https://cs.dastyare.social/.well-known/mcp
```

Response:

```json
{
  "mcpServers": {
    "ds-cs": {
      "url": "https://cs.dastyare.social/api/mcp"
    }
  }
}
```

---

## What you can do

### Read tools (no auth required)

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_posts` | List posts with pagination and search | `page`, `limit`, `search`, `type` (list/count/shorts) |
| `get_post` | Get a single post with reactions | `id` |
| `list_stories` | List stories with pagination | `page`, `limit`, `search`, `type` (image/video) |
| `get_story` | Get a single story | `id` |
| `count_stories` | Get total story count | (none) |

### Write tools (API key required)

| Tool | Description | Parameters |
|------|-------------|------------|
| `create_post` | Create a new post | `content`, `media[]` |
| `update_post` | Update content or pin status | `id`, `content`, `pinnedAt` |
| `delete_post` | Delete a post | `id` |
| `create_story` | Create a story | `type`, `media`, `views`, `likes` |
| `update_story` | Update a story | `id`, `type`, `views`, `likes`, `media` |
| `delete_story` | Delete a story | `id` |

---

## Examples

### List your latest posts

Ask your AI agent:

> "Show me my last 5 posts"

The agent will call `list_posts` with `{ page: 1, limit: 5 }` and display the results.

### Search posts

> "Find all posts about photography"

The agent will call `list_posts` with `{ search: "photography" }`.

### Count your content

> "How many posts and stories do I have?"

The agent calls `list_posts` with `{ type: "count" }` and `count_stories`.

### Create a post (requires API key)

> "Create a post that says 'Just shipped a new feature!'"

The agent calls `create_post` with `{ content: "Just shipped a new feature!" }`.

### Pin a post (requires API key)

> "Pin the post with ID abc123"

The agent calls `update_post` with `{ id: "abc123", pinnedAt: "2026-08-21T00:00:00Z" }`.

### Delete a post (requires API key)

> "Delete the post with ID abc123"

The agent calls `delete_post` with `{ id: "abc123" }`.

---

## Authentication

### Read access (public)

No authentication needed. Anyone — or any agent — can list and read posts and stories. This is by design: your public content should be discoverable.

### Write access (API key)

Create/edit/delete operations require your API key. The key is the same `API_KEY` you set in `.env`.

**Where to find it:**

- Check your `.env` file: `API_KEY=...`
- Or generate one: `openssl rand -hex 32`

**How it works:**

The MCP server checks the `Authorization: Bearer <API_KEY>` header on every request. If the key is missing or wrong, write tools return an error:

```
Write access denied. Connect with an Authorization: Bearer <API_KEY> header.
```

Read tools work regardless — they're public.

### Separate MCP key (optional)

If you want a different key for MCP than your main API key, set `MCP_API_KEY` in `.env`. The stdio server uses `MCP_API_KEY` first, then falls back to `API_KEY`. The remote HTTP server always uses `API_KEY`.

---

## Verifying it works

### Test with curl

```bash
# 1. Check discovery
curl https://cs.dastyare.social/.well-known/mcp

# 2. Initialize a session
curl -X POST https://cs.dastyare.social/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -D headers.txt \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'

# 3. Extract session ID from headers.txt
SESSION_ID=$(grep -i 'mcp-session-id:' headers.txt | tr -d '\r' | awk '{print $2}')

# 4. List tools
curl -X POST https://cs.dastyare.social/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# 5. Call a tool
curl -X POST https://cs.dastyare.social/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_posts","arguments":{"page":1,"limit":3}}}'
```

### Test with the interactive docs

Open `https://cs.dastyare.social/docs` — the Scalar UI shows all MCP tools with their schemas and lets you try them directly.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Session not found" | Re-initialize. Sessions expire after 1 hour of inactivity. |
| "Write access denied" | Add `Authorization: Bearer <API_KEY>` header to your MCP config. |
| MCP not showing in Claude Desktop | Restart the app after changing config. Check JSON syntax. |
| "Missing Mcp-Session-Id" | Your client isn't sending the session header. Make sure you're using the Streamable HTTP transport, not SSE. |
| Tools not appearing | Call `tools/list` after `initialize`. Some clients do this automatically. |
| Connection refused (local) | Make sure `bun run mcp` is running and your database is accessible. |

---

## How it works under the hood

```
Your AI agent                Your DS-CS server
     │                              │
     │── POST /api/mcp ────────────►│  initialize
     │◄── { result, session-id } ──│
     │                              │
     │── POST /api/mcp ────────────►│  tools/list
     │◄── { tools: [...] } ────────│
     │                              │
     │── POST /api/mcp ────────────►│  tools/call: list_posts
     │◄── { items: [...] } ────────│
```

- Each session gets its own MCP server instance and transport
- Sessions are pruned after 1 hour of inactivity
- CORS is enabled for browser-based MCP clients
- Analytics events are tracked: `mcp_session_created` and `mcp_tool_called`

---

## Further reading

- [AGENTS.md](../AGENTS.md) — MCP section with full tool reference
- [GUIDE.md](../GUIDE.md) — Section 10.8 MCP (agents)
- [llms.txt](https://cs.dastyare.social/llms.txt) — Machine-readable docs for LLM crawlers
- [OpenAPI spec](https://cs.dastyare.social/openapi.json) — REST API reference
