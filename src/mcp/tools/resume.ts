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
        "Read the /resume page configuration (config/resume.config.yml): enabled flag, general profile (name, avatar, jobTitle, website, about, contacts) and content sections (Work Experience, Education, ...). The page is served at {APP_URL}/resume only when enabled is true.",
      inputSchema: {},
    },
    async () => {
      const raw = readResumeYaml();
      if (!raw) return fail("config/resume.config.yml not found");
      return ok({
        path: "config/resume.config.yml",
        config: getResumeConfig(),
      });
    }
  );

  server.registerTool(
    "update_resume_config",
    {
      title: "Update resume config",
      description:
        "Replace the whole resume.config.yml with new YAML content. Rules: the first key MUST be `enabled:` (boolean), a `general` object with a non-empty `name` is required, optional `content` array of sections with title/items. Changes apply on the next request — no rebuild needed.",
      inputSchema: {
        yaml: z.string().describe("Complete resume.config.yml file contents"),
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
        "Toggle the /resume page on or off by flipping the `enabled` key in config/resume.config.yml. All other data is preserved and `enabled` stays the first key. When disabled, /resume renders the not-found page and leaves the sitemap.",
      inputSchema: {
        enabled: z.boolean().describe("true to show /resume, false to hide it"),
      },
    },
    async ({ enabled }) => {
      if (!opts.canWrite()) return fail("Write operations require API key auth");
      const error = setResumeEnabled(enabled);
      return error ? fail(error) : ok({ success: true, enabled });
    }
  );
}
