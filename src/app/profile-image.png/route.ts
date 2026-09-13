import { readFile } from "node:fs/promises";
import path from "node:path";

// Live channel avatar, served at the canonical /profile-image.png URL.
//
// Source priority is the user's project ./public (bind-mounted into the
// container, e.g. /app/public in dev or /app/brand in production), then the
// default baked into the image at /app/defaults/profile-image.png. Replacing
// the file needs no restart and no copying — the next request streams the new
// bytes.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE_CANDIDATES = [
  () => path.join(process.cwd(), "brand", "profile-image.png"),
  () => path.join(process.cwd(), "public", "profile-image.png"),
  () => path.join(process.cwd(), "defaults", "profile-image.png"),
];

async function readAvatar(): Promise<Buffer> {
  for (const candidate of SOURCE_CANDIDATES) {
    try {
      return await readFile(candidate());
    } catch {
      // try next priority level
    }
  }
  throw new Error("no avatar source found");
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