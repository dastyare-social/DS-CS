import { readFileSync } from "fs";
import { join } from "path";
import { captureServerEvent } from "@/lib/analytics/server";

export const dynamic = "force-dynamic";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=3600",
};

export async function GET() {
  captureServerEvent("llm_asset_requested", {
    asset: "openapi.json",
    path: "/openapi.json",
  });

  const content = readFileSync(join(process.cwd(), "public", "openapi.json"), "utf8");
  return new Response(content, { headers });
}
