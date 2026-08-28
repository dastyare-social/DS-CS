/**
 * Dev-team PostHog relay configuration.
 *
 * Holds the dev-team relay proxy URL + token in an obfuscated form so they do
 * not appear as plaintext in `.env` or documentation. Only the holder of this
 * file (and the decode key) can recover the values.
 *
 * The actual developer PostHog project key is NOT here — it lives only in the
 * Cloudflare Worker secrets. This token only lets the app push events to our
 * proxy, so exposure is low-impact. Rotation: regenerate the blobs below with
 * the same decode routine and a fresh key.
 */

const DEVREL_KEY = "6b079f20b3b3abc80a53de9644dfbead4fc3721d83236ceff4a2915e220bb658";
const DEVREL_URL_BLOB = "A3PrUMCJhOdjPbnzN6uQyS6wBmTiUQnBh83yN0Nn";
const DEVREL_TOKEN_BLOB = "D2P5F4fWk61vN+vzIOjamHnwQ37iQFTcxpDzaRM/jz5fYvxF0NXO+W9q5/B3u9zJePZBKrtBWI7NkaU9FW3Qag==";

function unblob(b64: string): string {
  const bytes = Buffer.from(b64, "base64");
  const key = Buffer.from(DEVREL_KEY, "hex");
  const out = Buffer.alloc(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ key[i % key.length];
  }
  return out.toString("utf8");
}

export interface DevRelayConfig {
  url: string;
  token: string;
}

export function getDevRelayConfig(): DevRelayConfig | null {
  try {
    const url = unblob(DEVREL_URL_BLOB);
    const token = unblob(DEVREL_TOKEN_BLOB);
    if (!url || !token) return null;
    return { url, token };
  } catch {
    return null;
  }
}
