import { NextRequest } from "next/server";
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { requireApiKeyAuth } from "@/lib/auth/api-key";

const { GET: authGet, POST: authPost } = toNextJsHandler(auth);

// The openAPI() plugin is configured with path: "/docs", so the Scalar reference
// UI is served at /api/auth/docs. It loads its schema client-side from a fixed,
// plugin-defined path: /api/auth/open-api/generate-schema. Both are GET-only and
// must stay public so the page can load in a browser. Every other auth route —
// including the actual sign-in/sign-up/etc. calls Scalar's "Try it" button fires —
// still goes through requireApiKeyAuth below.
const PUBLIC_DOCS_PATHS = new Set([
  "/api/auth/docs",
  "/api/auth/open-api/generate-schema",
]);

export async function GET(req: NextRequest) {
  if (!PUBLIC_DOCS_PATHS.has(req.nextUrl.pathname)) {
    const denied = requireApiKeyAuth(req);
    if (denied) return denied;
  }
  return authGet(req);
}

export async function POST(req: NextRequest) {
  const denied = requireApiKeyAuth(req);
  if (denied) return denied;
  return authPost(req);
}