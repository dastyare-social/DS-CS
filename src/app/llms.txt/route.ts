import { readFileSync } from "fs";
import { join } from "path";
import { captureServerEvent } from "@/lib/analytics/server";

export const dynamic = "force-dynamic";

const headers = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "public, max-age=3600",
};

export async function GET() {
  captureServerEvent("llm_asset_requested", {
    asset: "llms.txt",
    path: "/llms.txt",
  });

  const content = readFileSync(join(process.cwd(), "public", "llms.txt"), "utf8");
  return new Response(content, { headers });
}
