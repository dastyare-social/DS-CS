import { RPCHandler } from "@orpc/server/fetch";
import { appRouter } from "@/lib/orpc/router";

export const dynamic = "force-dynamic";

const handler = new RPCHandler(appRouter);

/**
 * oRPC Standard RPC endpoint.
 *
 * The catch-all segment is required: the client addresses procedures as
 * `/api/rpc/<namespace>/<procedure>`, so `app/api/rpc/route.ts` alone would only
 * ever match the bare `/api/rpc` and 404 every real call.
 *
 * Note that Next.js does not strip the matched segment from `req.url`, so the
 * handler still sees the full `/api/rpc/...` path.
 */
async function handle(req: Request) {
  try {
    const { matched, response } = await handler.handle(req, { prefix: "/api/rpc" });

    if (!matched) {
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    return response;
  } catch (err: unknown) {
    console.error("oRPC handler error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
}

export { handle as GET, handle as POST };