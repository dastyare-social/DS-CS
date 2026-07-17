import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

/** Serves README.md for LLM crawlers and agents */
export async function GET() {
  const content = readFileSync(join(process.cwd(), "README.md"), "utf8");
  return new Response(content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
