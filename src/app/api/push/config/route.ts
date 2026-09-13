import { NextResponse } from "next/server";

/**
 * Serve the VAPID public key to the client at runtime.
 *
 * The prebuilt image (`dastyaresocial/ds-cs`) is built WITHOUT the key: each
 * install generates its own VAPID pair, so `NEXT_PUBLIC_*` can't be baked into
 * the browser bundle at image build time. Reading it here from server-side env
 * (available at runtime) is what lets the client's pushManager.subscribe() work
 * on any prebuilt image.
 * @summary Config — VAPID Public Key
 * @description Returns whether push is configured and the VAPID public key read
 * from the runtime environment.
 * @tag Push
 * @response { configured: boolean, publicKey: string | null }
 * @ignore
 */
export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY;

  return NextResponse.json({
    configured: Boolean(publicKey),
    publicKey: publicKey ?? null,
  });
}