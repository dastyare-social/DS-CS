import { NextRequest } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/mcp/server";
import { getApiKeyConfig } from "@/lib/auth/api-key";
import { captureServerEvent, flushServerEvents } from "@/lib/analytics/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Each MCP session gets its own transport + server instance so reconnects and
// multiple clients work independently. Idle sessions are pruned after TTL.
const SESSION_TTL_MS = 60 * 60 * 1000;

type Session = {
  server: ReturnType<typeof createMcpServer>;
  transport: WebStandardStreamableHTTPServerTransport;
  connected: Promise<void>;
  authenticated: boolean;
  lastUsed: number;
};

const sessions = new Map<string, Session>();

function createSession(): Session {
  const sessionId = crypto.randomUUID();
  const session: Session = {
    server: createMcpServer({ canWrite: () => session.authenticated }),
    transport: new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
      sessionIdGenerator: () => sessionId,
    }),
    connected: Promise.resolve(),
    authenticated: false,
    lastUsed: Date.now(),
  };
  session.transport.onerror = (err) => {
    console.error("[mcp] transport error", err);
  };
  session.connected = session.server.connect(session.transport);
  sessions.set(sessionId, session);
  return session;
}

function pruneSessions() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastUsed > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

function isAuthenticated(req: NextRequest): boolean {
  const { apiKey } = getApiKeyConfig();
  if (!apiKey) return false;
  const header = req.headers.get("authorization") ?? "";
  return (
    header.startsWith("Bearer ") &&
    header.slice("Bearer ".length).trim() === apiKey
  );
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Mcp-Session-Id, Origin, Accept",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Last-Event-ID",
  "Cache-Control": "no-store",
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

async function handle(req: NextRequest): Promise<Response> {
  const sessionId = req.headers.get("mcp-session-id") ?? undefined;
  pruneSessions();

  let bodyText: string | null = null;
  let parsedBody: unknown = undefined;
  if (req.method === "POST") {
    bodyText = await req.text();
    try {
      parsedBody = JSON.parse(bodyText);
    } catch {
      parsedBody = undefined;
    }
  }

  const isInitialize =
    typeof parsedBody === "object" &&
    parsedBody !== null &&
    (parsedBody as { method?: unknown }).method === "initialize";

  // Detect MCP tool calls (some clients use `tools/call`, older ones use
  // `tools/call/<name>`). Used to track per-tool success/failure in analytics.
  const toolCallInfo = (() => {
    if (typeof parsedBody !== "object" || parsedBody === null) return null;
    const method = (parsedBody as { method?: string }).method;
    if (typeof method === "string" && method.startsWith("tools/call")) {
      const params = (parsedBody as { params?: { name?: unknown } }).params;
      const name =
        typeof params?.name === "string"
          ? params.name
          : method.replace("tools/call", "").replace(/^\//, "");
      return { name };
    }
    return null;
  })();

  let session: Session;
  if (sessionId && sessions.has(sessionId)) {
    session = sessions.get(sessionId)!;
  } else if (isInitialize) {
    session = createSession();
    captureServerEvent("mcp_session_created", {
      authenticated: session.authenticated,
    });
  } else {
    return new Response(
      sessionId
        ? "Session not found. Client should re-initialize."
        : "Missing Mcp-Session-Id header. Initialize first.",
      { status: sessionId ? 404 : 400, headers: CORS_HEADERS }
    );
  }

  session.lastUsed = Date.now();
  session.authenticated = isAuthenticated(req);
  await session.connected;

  // Track MCP tool calls (enriched with per-tool success/failure below, after
  // the response is available). Non-tool methods (initialize, resources/list,
  // tools/list, prompts/*) are tracked generically here.
  if (isInitialize) {
    // already tracked above
  } else if (parsedBody && typeof parsedBody === "object" && !toolCallInfo) {
    const method = (parsedBody as { method?: string }).method;
    if (method) {
      captureServerEvent("mcp_tool_called", {
        method,
        authenticated: session.authenticated,
      });
    }
  }

  let request: Request;
  if (bodyText != null) {
    request = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: bodyText,
      // @ts-expect-error duplex is not in the DOM RequestInit type
      duplex: "half",
    });
  } else {
    request = req;
  }

  let response = await session.transport.handleRequest(request, {
    parsedBody,
  });

  // Capture tool-call outcomes (isError) for observability. In JSON response
  // mode the body is a fully buffered JSON-RPC message, so it is safe to read
  // and re-emit identically.
  if (toolCallInfo) {
    try {
      const raw = await response.text();
      let errored = false;
      try {
        const parsed = JSON.parse(raw);
        const result = Array.isArray(parsed) ? parsed[0]?.result : parsed?.result;
        errored = Boolean(
          result?.isError === true ||
            // JSON-RPC error responses (result missing / error present)
            (!Array.isArray(parsed) && parsed?.error)
        );
      } catch {
        errored = false;
      }
      captureServerEvent("mcp_tool_called", {
        method: "tools/call",
        tool: toolCallInfo.name,
        authenticated: session.authenticated,
        isError: errored,
      });
      response = new Response(raw, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch {
      // If we can't inspect the body, leave the response untouched.
    }
  }

  if (req.method === "DELETE" && sessionId) {
    sessions.delete(sessionId);
  }

  // Flush analytics events before response (important in serverless)
  await flushServerEvents();

  return withCors(response);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function DELETE(req: NextRequest) {
  return handle(req);
}
