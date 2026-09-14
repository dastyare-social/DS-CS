import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const S3_PREFIX = "animated-emojies";
const ALLOWED_EXTENSION = /\.webp$/i;

function s3PublicBase(): string | null {
  const s3PublicBase = process.env.S3_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (s3PublicBase) return s3PublicBase;

  const s3Endpoint = process.env.S3_ENDPOINT?.replace(/\/+$/, "");
  const s3Bucket = process.env.S3_BUCKET_NAME || "";
  if (s3Endpoint) return `${s3Endpoint}/${s3Bucket}`;

  return null;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const filename = path.join("/");

  if (!filename || !ALLOWED_EXTENSION.test(filename) || filename.includes("..")) {
    return new Response("not found", { status: 404 });
  }

  const base = s3PublicBase();
  if (!base) {
    return new Response("not found", { status: 404 });
  }

  const upstreamUrl = `${base}/${S3_PREFIX}/${filename}`;
  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        Accept: "image/webp,image/*;q=0.8,*/*;q=0.5",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return new Response("not found", { status: 404 });
    }

    const body = new Uint8Array(await upstream.arrayBuffer());
    return new Response(body, {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(body.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}