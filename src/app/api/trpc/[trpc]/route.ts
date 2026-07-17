import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/lib/trpc/router";
import { createContext } from "@/lib/trpc/trpc";

export const dynamic = "force-dynamic";

/** @ignore Internal tRPC endpoint for frontend use only */
export async function GET(req: Request) {
  try {
    console.log("tRPC catch-all request:", req.method, req.url);
    const res = await fetchRequestHandler({
      req,
      router: appRouter,
      createContext,
      endpoint: "/api/trpc",
    });

    try {
      const clone = res.clone();
      const text = await clone.text();
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        console.warn("tRPC non-JSON response:", req.url, ct, text.slice(0, 500));
      }
    } catch (e) {
      console.warn("tRPC response read failed", e);
    }

    return res;
  } catch (err: any) {
    console.error("tRPC catch-all GET error:", err);
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
    console.error("tRPC catch-all POST error:", err);
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
