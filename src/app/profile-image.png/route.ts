import { readFile } from "node:fs/promises";
import path from "node:path";

// Live channel avatar, served at the canonical /profile-image.png URL.
//
// The project's ./public is bind-mounted into the container at /app/brand (a
// directory mount, so editors that save via rename-over cannot orphan the
// inode). The user's public/profile-image.png therefore takes priority and is
// streamed fresh on every request, with the default baked into the image at
// /app/defaults/profile-image.png as the fallback. No restart is needed after
// replacing the file — just reload the page.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readAvatar(): Promise<Buffer> {
  try {
    return await readFile(path.join(process.cwd(), "brand", "profile-image.png"));
  } catch {
    return readFile(path.join(process.cwd(), "defaults", "profile-image.png"));
  }
}

export async function GET(): Promise<Response> {
  try {
    const data = await readAvatar();
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store, max-age=0",
        "Content-Length": String(data.byteLength),
      },
    });
  } catch {
    return new Response("avatar not found", { status: 404 });
  }
}