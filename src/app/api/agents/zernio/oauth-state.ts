import { cookies } from "next/headers";

export const ZERNIO_STATE_COOKIE = "zernio_oauth_state";
export const ZERNIO_STATE_MAX_AGE = 10 * 60;

export interface ZernioOAuthState {
  userId: string;
  state: string;
  returnTo: string;
}

/** Only same-origin paths are accepted as a post-connect destination. */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/os";
  }
  return value;
}

export async function setZernioStateCookie(next: ZernioOAuthState) {
  const store = await cookies();
  store.set(ZERNIO_STATE_COOKIE, JSON.stringify(next), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") ?? false,
    path: "/api/agents/zernio",
    maxAge: ZERNIO_STATE_MAX_AGE,
  });
}

export async function readZernioStateCookie(): Promise<ZernioOAuthState | null> {
  const store = await cookies();
  const raw = store.get(ZERNIO_STATE_COOKIE)?.value;
  store.delete(ZERNIO_STATE_COOKIE);

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ZernioOAuthState>;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.state !== "string" ||
      typeof parsed.returnTo !== "string"
    ) {
      return null;
    }
    return {
      userId: parsed.userId,
      state: parsed.state,
      returnTo: safeReturnPath(parsed.returnTo),
    };
  } catch {
    return null;
  }
}
