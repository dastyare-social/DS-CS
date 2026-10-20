import { NextRequest, NextResponse } from "next/server";
import { auth as completeOAuth } from "@mastra/mcp";

import { auth } from "@/lib/auth";
import { createZernioMcpClient } from "@/mastra/mcp/zernio";
import { ZERNIO_MCP_URL } from "@/mastra/oauth/zernio-provider";
import { readZernioStateCookie, safeReturnPath } from "../oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectWith(
  req: NextRequest,
  returnTo: string,
  outcome: "connected" | "error",
  reason?: string,
) {
  const target = new URL(safeReturnPath(returnTo), req.url);
  target.searchParams.set("zernio", outcome);
  if (reason) target.searchParams.set("reason", reason);
  return NextResponse.redirect(target);
}

/**
 * Hosted OAuth callback for Zernio.
 *
 * The SDK's loopback helper is not usable for an HTTPS redirect URI, so this
 * route drives the provider directly: it validates the `state` that the
 * authorize route pinned, confirms the Better Auth session still matches, then
 * lets `auth()` exchange the code using the PKCE verifier and discovery state
 * already persisted by `PostgresOAuthStorage`.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const stored = await readZernioStateCookie();

  if (params.get("error")) {
    return redirectWith(
      req,
      stored?.returnTo ?? "/os",
      "error",
      params.get("error") ?? "authorization_failed",
    );
  }

  if (!stored) {
    return NextResponse.json(
      { error: "OAuth state expired or missing. Start the connection again." },
      { status: 400 },
    );
  }

  const code = params.get("code");
  const state = params.get("state");

  if (!code || !state || state !== stored.state) {
    return redirectWith(req, stored.returnTo, "error", "invalid_state");
  }

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.id !== stored.userId) {
    return redirectWith(req, stored.returnTo, "error", "session_mismatch");
  }

  const { authProvider } = createZernioMcpClient({ userId: session.user.id });

  try {
    const result = await completeOAuth(authProvider, {
      serverUrl: new URL(ZERNIO_MCP_URL),
      authorizationCode: code,
    });

    if (result !== "AUTHORIZED") {
      return redirectWith(req, stored.returnTo, "error", "authorization_failed");
    }
  } catch (error) {
    console.error("[zernio] OAuth code exchange failed", error);
    return redirectWith(req, stored.returnTo, "error", "exchange_failed");
  }

  return redirectWith(req, stored.returnTo, "connected");
}
