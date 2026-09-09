import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { webhooks } from "@/lib/db/schema/webhooks";
import { newWebhookSecret, WEBHOOK_EVENTS } from "@/lib/webhooks";
import { fail, notFound, ok } from "../result";

const WebhookEvent = z.enum(WEBHOOK_EVENTS);

export function registerWebhookTools(
  server: McpServer,
  opts: { canWrite: () => boolean }
) {
  server.registerTool(
    "list_webhooks",
    {
      title: "List webhooks",
      description:
        "List all registered webhook endpoints with their subscribed events and delivery status (lastStatus, lastAttemptAt, failureCount).",
      inputSchema: {},
    },
    async () => {
      try {
        const items = await db
          .select()
          .from(webhooks)
          .orderBy(desc(webhooks.createdAt));
        return ok({ items, total: items.length });
      } catch (err: unknown) {
        return fail(err instanceof Error ? err.message : "Internal Server Error");
      }
    }
  );

  server.registerTool(
    "get_webhook",
    {
      title: "Get webhook by ID",
      description:
        "Fetch a single registered webhook endpoint by its id, including subscribed events, secret, and delivery status.",
      inputSchema: {
        webhookId: z.string().describe("The webhook endpoint id"),
      },
    },
    async ({ webhookId }) => {
      try {
        const [hook] = await db
          .select()
          .from(webhooks)
          .where(eq(webhooks.id, webhookId));
        if (!hook) return notFound("Webhook", webhookId);
        return ok(hook);
      } catch (err: unknown) {
        return fail(err instanceof Error ? err.message : "Internal Server Error");
      }
    }
  );

  server.registerTool(
    "create_webhook",
    {
      title: "Create webhook",
      description:
        "Register a new endpoint that will receive signed POST deliveries for the subscribed events (e.g. post.created, story.viewed). Generates a per-endpoint HMAC secret returned only in this response. Requires API key auth.",
      inputSchema: {
        url: z.string().url().describe("HTTPS URL that will receive deliveries"),
        events: z
          .array(WebhookEvent)
          .min(1)
          .describe(`Events to subscribe to: ${WEBHOOK_EVENTS.join(", ")}`),
      },
    },
    async ({ url, events }) => {
      if (!opts.canWrite())
        return fail("Write operations require API key auth");
      try {
        const [hook] = await db
          .insert(webhooks)
          .values({
            id: randomUUID(),
            url,
            events: [...events],
            secret: newWebhookSecret(),
          })
          .returning();
        return ok(hook);
      } catch (err: unknown) {
        return fail(err instanceof Error ? err.message : "Internal Server Error");
      }
    }
  );

  server.registerTool(
    "update_webhook",
    {
      title: "Update webhook",
      description:
        "Partially update a webhook endpoint: URL, subscribed events, or active status. Passing active=false pauses deliveries without deleting the endpoint. Requires API key auth.",
      inputSchema: {
        webhookId: z.string().describe("The webhook endpoint id"),
        url: z.string().url().optional().describe("New delivery URL"),
        events: z
          .array(WebhookEvent)
          .min(1)
          .optional()
          .describe("New set of subscribed events"),
        active: z.boolean().optional().describe("false to pause deliveries"),
      },
    },
    async ({ webhookId, ...patch }) => {
      if (!opts.canWrite())
        return fail("Write operations require API key auth");
      if (Object.keys(patch).length === 0)
        return fail("At least one field is required");
      try {
        const [updated] = await db
          .update(webhooks)
          .set({
            ...(patch.url !== undefined && { url: patch.url }),
            ...(patch.events !== undefined && { events: [...patch.events] }),
            ...(patch.active !== undefined && { active: patch.active }),
          })
          .where(eq(webhooks.id, webhookId))
          .returning();
        if (!updated) return notFound("Webhook", webhookId);
        return ok(updated);
      } catch (err: unknown) {
        return fail(err instanceof Error ? err.message : "Internal Server Error");
      }
    }
  );

  server.registerTool(
    "delete_webhook",
    {
      title: "Delete webhook",
      description:
        "Permanently delete a webhook endpoint by id and stop all future deliveries. Requires API key auth.",
      inputSchema: {
        webhookId: z.string().describe("The webhook endpoint id"),
      },
    },
    async ({ webhookId }) => {
      if (!opts.canWrite())
        return fail("Write operations require API key auth");
      try {
        const [deleted] = await db
          .delete(webhooks)
          .where(eq(webhooks.id, webhookId))
          .returning({ id: webhooks.id });
        if (!deleted) return notFound("Webhook", webhookId);
        return ok({ success: true, id: deleted.id });
      } catch (err: unknown) {
        return fail(err instanceof Error ? err.message : "Internal Server Error");
      }
    }
  );
}