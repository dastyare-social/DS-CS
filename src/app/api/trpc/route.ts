import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/lib/trpc/router";
import { createContext } from "@/lib/trpc/trpc";

export const dynamic = "force-dynamic";

/** @ignore Internal tRPC endpoint for frontend use only */
export async function GET(req: Request) {
  try {
    return await fetchRequestHandler({
      req,
      router: appRouter,
      createContext,
      endpoint: "/api/trpc",
    });
  } catch (err: any) {
    console.error("tRPC handler GET error:", err);
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

/** @ignore Internal tRPC endpoint for frontend use only */
export async function POST(req: Request) {
  try {
    return await fetchRequestHandler({
      req,
      router: appRouter,
      createContext,
      endpoint: "/api/trpc",
    });
  } catch (err: any) {
    console.error("tRPC handler POST error:", err);
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
