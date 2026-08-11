import { NextRequest, NextResponse } from "next/server";
import { requireApiKeyAuth } from "@/lib/auth/api-key";
import { auth } from "@/lib/auth";

export async function requireMediaAuth(
  req: NextRequest
): Promise<NextResponse | null> {
  // 1) Shared API key (with per-client rate limiting).
  const apiKeyResult = requireApiKeyAuth(req);
  if (!apiKeyResult) return null;

  // 2) Fall back to a valid Better Auth session (cookie/bearer).
  const session = await auth.api.getSession({ headers: req.headers });
  if (session) return null;

  // Not authorized by either method — return the API-key failure response.
  return apiKeyResult;
}
