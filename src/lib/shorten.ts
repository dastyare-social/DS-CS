import { app_url } from "@/config/app";

const URL_REGEX = /https?:\/\/[^\s)>\]]+/g;

function isShortLink(url: string): boolean {
  const shUrl = process.env.DS_SH_URL;
  if (!shUrl) return false;
  return url.startsWith(`${shUrl}/r/`);
}

/**
 * Shorten a URL via the local Dastyare Social SH instance.
 *
 * Returns the original URL unchanged when the shortener is not configured
 * or the request fails, so callers never need to handle errors.
 */
export async function shortenUrl(url: string): Promise<string> {
  const shUrl = process.env.DS_SH_URL;
  const shApiKey = process.env.DS_SH_API_KEY;
  if (!shUrl || !shApiKey) return url;

  try {
    const res = await fetch(`${shUrl}/api/links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${shApiKey}`,
      },
      body: JSON.stringify({ r_to: url }),
    });

    if (!res.ok) return url;

    const data = (await res.json()) as { r_path?: string };
    if (!data.r_path) return url;

    return `${shUrl}/r/${data.r_path}`;
  } catch {
    return url;
  }
}

/**
 * Build the full absolute URL for a site path, then shorten it.
 * The short link redirects back to the canonical path on this site.
 */
export async function shortenSitePath(path: string): Promise<string> {
  const fullUrl = `${app_url}${path}`;
  return shortenUrl(fullUrl);
}

/**
 * Find all URLs in a content string, shorten the ones that aren't already
 * DS_SH short links, and return the content with URLs replaced.
 */
export async function shortenContentUrls(content: string): Promise<string> {
  const urls = content.match(URL_REGEX);
  if (!urls) return content;

  const unique = [...new Set(urls)];
  const replacements = await Promise.all(
    unique.map(async (url) => ({
      original: url,
      shortened: isShortLink(url) ? url : await shortenUrl(url),
    }))
  );

  let result = content;
  for (const { original, shortened } of replacements) {
    result = result.replaceAll(original, shortened);
  }
  return result;
}
