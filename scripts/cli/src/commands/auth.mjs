import { clearAuth, configPath, readAuth, redact, writeAuth } from "../auth.mjs";
import { CliError } from "../utils/errors.mjs";
import { log } from "../utils/log.mjs";
import { promptText } from "../utils/prompt.mjs";

/**
 * Store channel credentials and prove they work before saving them.
 *
 * The verification matters: an API key typed from memory is often wrong, and
 * discovering that at the first `create_post` — inside an agent, mid-task — is a
 * much worse place to find out than at login.
 */
export async function loginCommand(positional, flags) {
  const baseUrl =
    flags.url ??
    positional[0] ??
    process.env.DS_CS_URL ??
    (await readAuth()).baseUrl ??
    (await promptText("Channel URL:", "https://cs.dastyare.social"));

  if (!baseUrl) {
    throw new CliError("A channel URL is required", { hint: "Pass --url https://your-channel.com" });
  }

  const normalized = baseUrl.replace(/\/+$/, "");
  const apiKey = flags.apiKey ?? (await promptText("API key (blank for read-only):", ""));

  await verify(normalized, apiKey);

  const file = await writeAuth({ baseUrl: normalized, apiKey: apiKey || null });

  log.success(`Logged in to ${normalized}`);
  if (apiKey) {
    log.info(`  key   ${redact(apiKey)}`);
  } else {
    log.warn("  no API key stored — read tools only");
  }
  log.info(`  saved ${file} (mode 0600)`);
}

async function verify(baseUrl, apiKey) {
  const headers = apiKey ? { authorization: `Bearer ${apiKey}` } : {};
  let response;
  try {
    response = await fetch(`${baseUrl}/api/posts?type=count`, { headers });
  } catch (error) {
    throw new CliError(`Could not reach ${baseUrl}`, {
      hint: "Check the URL and that the channel is running.",
      cause: error,
    });
  }

  if (response.status === 401 || response.status === 403) {
    throw new CliError(`${baseUrl} rejected the API key`, {
      hint: "The key is the API_KEY from your channel's .env. Read access needs no key.",
    });
  }
  if (!response.ok) {
    throw new CliError(`${baseUrl} returned ${response.status} ${response.statusText}`);
  }

  const body = await response.json().catch(() => null);
  log.info(`  connected — ${body?.total ?? "?"} posts visible`);
}

export async function whoamiCommand() {
  const stored = await readAuth();

  if (!stored.baseUrl) {
    log.info("Not logged in. Run `ds-cs login --url https://your-channel.com`.");
    log.info(`  (credentials would live in ${configPath()})`);
    return;
  }

  log.info(`Channel  ${stored.baseUrl}`);
  log.info(`API key  ${stored.apiKey ? redact(stored.apiKey) : "none (read-only)"}`);
  if (stored.loggedInAt) log.info(`Since    ${stored.loggedInAt}`);
}

export async function logoutCommand() {
  const removed = await clearAuth();
  if (removed) {
    log.success(`Removed ${configPath()}`);
  } else {
    log.info("No stored credentials to remove.");
  }
}
