import { app_url } from "@/config/app";

export const dynamic = "force-dynamic";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=3600",
  "Access-Control-Allow-Origin": "*",
};

export async function GET() {
  return new Response(
    JSON.stringify(
      {
        mcpServers: {
          dastyare: {
            url: `${app_url}/api/mcp`,
          },
        },
      },
      null,
      2
    ),
    { headers }
  );
}
