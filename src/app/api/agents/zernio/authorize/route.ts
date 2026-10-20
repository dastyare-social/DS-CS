import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { createZernioMcpClient } from "@/mastra/mcp/zernio";
import { isZernioOAuthConfigured } from "@/mastra/oauth/zernio-provider";
import { safeReturnPath, setZernioStateCookie } from "../oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Starts the Zernio OAuth 2.1 authorization-code + PKCE flow for the signed-in
 * user.
 *
 * Mastra's interactive `authenticate()` helper only supports loopback
 * callbacks. This route instead pins the `state`, persists the PKCE verifier
 * through the provider's `OAuthStorage`, triggers discovery with a tool-list
 * attempt, captures the authorization URL and redirects the browser to it. The
 * callback route completes the exchange.
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isZernioOAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Zernio OAuth is not configured. Set ZERNIO_CLIENT_METADATA_URL or ZERNIO_CLIENT_ID.",
      },
      { status: 503 },
    );
  }

  const returnTo = safeReturnPath(req.nextUrl.searchParams.get("returnTo"));
  // Array element access is not narrowed by TypeScript's control flow, unlike
  // a `let` assigned inside a callback.
  const captured: URL[] = [];

  const { client, authProvider } = createZernioMcpClient({
    userId: session.user.id,
    onRedirectToAuthorization: (url) => {
      captured[0] = url;
    },
  });

  const state = await authProvider.beginAuthorizationSession();

  await setZernioStateCookie({
    userId: session.user.id,
    state,
    returnTo,
  });

  try {
    // A 401/needs-auth rejection is the expected path: it makes the provider
    // discover the authorization server and emit the authorization URL.
    await client.listTools();
  } catch {
    // The URL captured above is the outcome we need. A failed list also covers
    // "already authorized but the server is temporarily unreachable", which
    // the redirect below resolves by sending the user back.
  } finally {
    await client.disconnect().catch(() => {});
    authProvider.endAuthorizationSession();
  }

  if (!captured[0]) {
    return NextResponse.redirect(
      new URL(`${returnTo}?zernio=connected`, req.url),
    );
  }

  return NextResponse.redirect(captured[0]);
}
