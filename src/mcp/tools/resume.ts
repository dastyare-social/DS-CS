import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getResumeConfig,
  readResumeYaml,
  setResumeEnabled,
  writeResumeYaml,
} from "@/lib/api/resume";
import { fail, ok } from "../result";

export function registerResumeTools(
  server: McpServer,
  opts: { canWrite: () => boolean }
) {
  server.registerTool(
    "get_resume_config",
    {
      title: "Get resume config",
      description:
        "Read the /about page configuration (config/about.config.yml): enabled flag, general profile (name, avatar, jobTitle, website, about, contacts) and content sections (Work Experience, Education, ...). The page is served at {APP_URL}/about only when enabled is true.",
      inputSchema: {},
    },
    async () => {
      const raw = readResumeYaml();
      if (!raw) return fail("config/about.config.yml not found");
      return ok({
        path: "config/about.config.yml",
        config: getResumeConfig(),
      });
    }
  );

  server.registerTool(
    "update_resume_config",
    {
      title: "Update resume config",
      description:
        "Replace the whole about.config.yml with new YAML content. Rules: the first key MUST be `enabled:` (boolean), a `general` object with a non-empty `name` is required, optional `content` array of sections with title/items. Changes apply on the next request — no rebuild needed.",
      inputSchema: {
        yaml: z.string().describe("Complete about.config.yml file contents"),
      },
    },
    async ({ yaml }) => {
      if (!opts.canWrite()) return fail("Write operations require API key auth");
      const error = writeResumeYaml(yaml);
      return error ? fail(error) : ok({ success: true });
    }
  );

  server.registerTool(
    "set_resume_enabled",
    {
      title: "Enable or disable resume page",
      description:
        "Toggle the /about page on or off by flipping the `enabled` key in config/about.config.yml. All other data is preserved and `enabled` stays the first key. When disabled, /about renders the not-found page and leaves the sitemap.",
      inputSchema: {
        enabled: z.boolean().describe("true to show /about, false to hide it"),
      },
    },
    async ({ enabled }) => {
      if (!opts.canWrite()) return fail("Write operations require API key auth");
      const error = setResumeEnabled(enabled);
      return error ? fail(error) : ok({ success: true, enabled });
    }
  );
}
