import { readFileSync } from "fs";
import { join } from "path";
import { captureServerEvent } from "@/lib/analytics/server";

export const dynamic = "force-dynamic";

const MARKDOWN_HEADERS = {
  "Content-Type": "text/markdown; charset=utf-8",
  "Cache-Control": "public, max-age=3600",
};

/** Serves CONTEXT.md for LLM crawlers and agents */
export async function GET() {
  await captureServerEvent("llm_asset_requested", {
    asset: "context.md",
    path: "/context.md",
  });
  const content = readFileSync(join(process.cwd(), "CONTEXT.md"), "utf8");
  return new Response(content, { headers: MARKDOWN_HEADERS });
}
