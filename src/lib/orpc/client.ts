import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import type { AppRouter } from "./router";

const RPC_BASE_PATH = "/api/rpc";

/**
 * Resolve the RPC endpoint to an absolute URL.
 *
 * oRPC's `StandardRPCLink` does `new URL(baseUrl)`, which throws
 * "Failed to construct 'URL': Invalid URL" for a relative path. tRPC tolerated
 * relative URLs, so passing "/api/rpc" straight through silently breaks every
 * client call at runtime while still type-checking.
 *
 * `RPCLink.url` accepts a function, and it is only invoked when a request is
 * actually issued — i.e. in the browser, never during SSR. That is what makes
 * it safe to touch `window` here.
 */
export function resolveRpcUrl(): string {
  if (typeof window === "undefined") {
    // Only reachable if something calls this outside a browser. Throwing a
    // clear error beats a confusing invalid-URL failure deep in the link.
    throw new Error("resolveRpcUrl() called outside the browser");
  }
  return new URL(RPC_BASE_PATH, window.location.origin).toString();
}

export const RPC_BASE_PATH_CONST = RPC_BASE_PATH;

/**
 * Browser RPC client.
 *
 * The action layer's consumers are all `"use client"` components, so this only
 * ever runs in the browser. Server-side callers (e.g. the OG image route)
 * import `@/lib/api/*` directly and never come through here.
 *
 * oRPC's Standard RPC serializer handles `Date`, `Map`, `Set`, `BigInt`, `NaN`
 * and `undefined` natively — this replaces the superjson transformer the tRPC
 * client used to carry.
 */
export const orpc: RouterClient<AppRouter> = createORPCClient(
  new RPCLink({
    url: resolveRpcUrl,
  }),
);