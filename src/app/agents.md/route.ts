import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

const MARKDOWN_HEADERS = {
  "Content-Type": "text/markdown; charset=utf-8",
  "Cache-Control": "public, max-age=3600",
};

function serveMarkdown(filename: string) {
  const content = readFileSync(join(process.cwd(), filename), "utf8");
  return new Response(content, { headers: MARKDOWN_HEADERS });
}

/** Serves AGENTS.md for LLM crawlers and agents */
export async function GET() {
  return serveMarkdown("AGENTS.md");
}
