import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { CliError } from "../utils/errors.mjs";
import { MAX_ARCHIVE_BYTES } from "./archive.mjs";

/** GitHub API + raw + codeload are the only hosts the fetcher trusts implicitly. */
const DEFAULT_TIMEOUT_MS = Number(process.env.DS_CS_FETCH_TIMEOUT_MS ?? 30_000);

export function cacheDir() {
  const base =
    process.env.XDG_CACHE_HOME ??
    (process.env.HOME ? path.join(process.env.HOME, ".cache") : os.tmpdir());
  return path.join(base, "ds-cs");
}

/**
 * Download `url`, following redirects (GitHub's codeload and raw endpoints both
 * bounce to a versioned host).
 *
 * `accept` lets a caller assert what it asked for — a registry URL that starts
 * returning an HTML error page is a failure, not a 200 to be parsed.
 */
export async function fetchWithTimeout(url, { accept, timeoutMs = DEFAULT_TIMEOUT_MS, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "ds-cs-cli",
        ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
        ...(process.env.GH_TOKEN ? { authorization: `Bearer ${process.env.GH_TOKEN}` } : {}),
        ...headers,
      },
    });

    if (!response.ok) {
      throw new CliError(`Request failed with ${response.status} ${response.statusText}`, {
        hint: url.includes("github.com") ? "For private repositories, set GITHUB_TOKEN." : undefined,
      });
    }

    if (accept) {
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes(accept)) {
        throw new CliError(
          `Expected ${accept} from ${url} but received "${contentType || "no content-type"}"`,
          { hint: "The URL may be an error page rather than the registry." }
        );
      }
    }

    return response;
  } catch (error) {
    if (error instanceof CliError) throw error;
    if (error.name === "AbortError") {
      throw new CliError(`Timed out after ${timeoutMs}ms fetching ${url}`);
    }
    throw new CliError(`Could not reach ${url}: ${error.message}`, { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(url, options) {
  const response = await fetchWithTimeout(url, { accept: "json", ...options });
  const body = await response.text();
  if (body.length > MAX_ARCHIVE_BYTES) {
    throw new CliError("Response is larger than the CLI allows");
  }
  return body;
}

export async function fetchJson(url, options) {
  return JSON.parse(await fetchText(url, options));
}

export async function fetchBuffer(url, options) {
  const response = await fetchWithTimeout(url, options);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_ARCHIVE_BYTES) {
    throw new CliError(
      `Download is ${(buffer.length / 1024 / 1024).toFixed(1)}MB, over the ${
        MAX_ARCHIVE_BYTES / 1024 / 1024
      }MB limit`,
      { hint: "Clone the repository and pass a local path instead." }
    );
  }
  return buffer;
}

/**
 * Download once into the cache, keyed by a hash of the URL. Repeated `ds-cs add`
 * runs in the same session then cost nothing, while a different ref never reads
 * a stale entry.
 */
export async function cachedBuffer(url, key, options) {
  const file = path.join(cacheDir(), `${key}.bin`);
  if (process.env.DS_CS_NO_CACHE) return fetchBuffer(url, options);

  try {
    return await fs.readFile(file);
  } catch {
    const buffer = await fetchBuffer(url, options);
    await fs.mkdir(cacheDir(), { recursive: true });
    await fs.writeFile(file, buffer).catch(() => {
      // A read-only cache directory must not fail the install.
    });
    return buffer;
  }
}
