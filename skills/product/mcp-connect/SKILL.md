---
name: mcp-connect
description: Connect an AI agent to a DS-CS channel over MCP — remote HTTP or local stdio — and choose the right transport for the situation. Use when setting up Claude Desktop, Cursor, Claude Code, OpenCode or Windsurf against a channel, when MCP tools are not appearing, or when an agent needs read or write access to a channel's posts and stories.
---

# Connecting an agent over MCP

## Why this exists

Without MCP, an agent has to read docs, guess URLs, and hand-build HTTP requests — it works, and it gets the auth header wrong. With MCP the agent asks the server what tools exist and gets typed schemas. For anything an agent does repeatedly against a channel, wire MCP rather than teaching it `curl`.

## Two transports

**Remote (HTTP)** — the channel serves MCP at `/api/mcp`. Any client connects over the network. No local process, works for clients on other machines, survives the channel moving.

**Local (stdio)** — `bun run mcp` runs a stdio server that talks straight to the database. Faster and works offline, but requires a local clone with `DATABASE_URL` and `API_KEY` set. Useful in development; not what a user should be running.

## Let the CLI write the config

```bash
ds-cs login --url https://cs.example.com --api-key "$API_KEY"
ds-cs mcp                       # print every format
ds-cs mcp claude-code           # write .mcp.json
ds-cs mcp opencode              # write opencode.json
ds-cs mcp cursor                # write .cursor/mcp.json
```

`ds-cs init --mcp` does the same during project setup. An existing config file is never overwritten — the CLI prints the snippet and leaves the merge to you, because clobbering a working MCP config to add one server is a bad trade.

## The config

**Remote with write access:**

```json
{
  "mcpServers": {
    "ds-cs": {
      "url": "https://cs.example.com/api/mcp",
      "headers": { "Authorization": "Bearer YOUR_API_KEY" }
    }
  }
}
```

**Local:**

```json
{
  "mcpServers": {
    "ds-cs": { "command": "bun", "args": ["run", "mcp"], "cwd": "/path/to/ds-cs" }
  }
}
```

Dropping the `headers` block leaves read-only access — which works, because reads are public by design.

## Tools

**Read (no auth):** `list_posts`, `get_post`, `list_stories`, `get_story`, `count_stories`, `get_resume_config`

**Write (API key):** `create_post`, `update_post`, `delete_post`, `create_story`, `update_story`, `delete_story`, `update_resume_config`, `set_resume_enabled`

## Auth

Read tools work without a key. Write tools require `Authorization: Bearer <API_KEY>`, where the key is the channel's `API_KEY` from `.env`. The remote HTTP server always uses `API_KEY`; the stdio server prefers `MCP_API_KEY` and falls back to `API_KEY` — that separation lets you give a local session a different key than production.

Missing key returns:

```
Write access denied. Connect with an Authorization: Bearer <API_KEY> header.
```

## Verify it works

```bash
curl https://cs.example.com/.well-known/mcp
```

Then, over the wire:

```bash
curl -X POST https://cs.example.com/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -D headers.txt \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'

SESSION_ID=$(grep -i 'mcp-session-id:' headers.txt | tr -d '\r' | awk '{print $2}')

curl -X POST https://cs.example.com/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

`tools/list` returning a populated array is the real test — clients vary in whether they call it automatically.

Interactive docs are at `https://cs.example.com/docs`, where every tool's schema can be exercised in the browser.

## Troubleshooting

| Problem | Fix |
|---|---|
| Server not listed | Restart the client after editing config; check JSON syntax |
| "Session not found" | Re-initialize. Sessions expire after an hour idle |
| "Missing Mcp-Session-Id" | Use the Streamable HTTP transport, not SSE |
| Tools empty | Call `tools/list` after `initialize` |
| "Write access denied" | Add the `Authorization` header |
| Connection refused (local) | `bun run mcp` must be running, `DATABASE_URL` reachable |

Sessions are pruned after an hour of inactivity, and each session gets its own server instance. CORS is enabled for browser-based clients.

## Beyond the tools

Connecting MCP does not give an agent product judgement — it gives it typed access. Anything about *how* to operate the channel (media limits, what a short is, when to pin) belongs in a skill, installed with `ds-cs add`. The combination is the point: tools for capability, skills for conduct.
