import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { desc } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { webhooks } from "@/lib/db/schema/webhooks";
import { captureServerEvent } from "@/lib/analytics/server";
import { requireApiKeyAuth } from "@/lib/auth/api-key";
import { isDemoMode } from "@/lib/demo-mode";
import { newWebhookSecret, WEBHOOK_EVENTS } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

/** @id WebhookEventInput */
export const WebhookEventInput = z.enum(WEBHOOK_EVENTS);

/** @id WebhookSchema */
export const WebhookSchema = z.object({
  id: z.string(),
  url: z.string(),
  events: z.array(z.string()),
  secret: z.string(),
  active: z.boolean(),
  lastStatus: z.string().nullable(),
  lastAttemptAt: z.string().nullable(),
  failureCount: z.number(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

/** @id WebhooksListResponse */
export const WebhooksListResponse = z.object({
  items: z.array(WebhookSchema),
  total: z.number(),
});

/** @id CreateWebhookBody */
export const CreateWebhookBody = z.object({
  url: z.string().url(),
  events: z.array(WebhookEventInput).min(1),
});

/** @id WebhookSuccessResponse */
export const WebhookSuccessResponse = z.object({
  success: z.boolean(),
});

/**
 * List or create webhooks
 * @summary Webhooks — List Endpoints
 * @description Returns all registered webhook endpoints with their subscribed events and delivery status.
 * @tag Webhooks
 * @response WebhooksListResponse
 * @examples response: {"items":[{"id":"5f4e3d2c-1b0a-4987-6543-210fedcba987","url":"https://example.com/hooks/ds","events":["post.created","story.created"],"secret":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","active":true,"lastStatus":"ok","lastAttemptAt":"2026-08-23T10:15:00.000Z","failureCount":0,"createdAt":"2026-08-23T09:00:00.000Z","updatedAt":"2026-08-23T10:15:00.000Z"}],"total":1}
 * @openapi
 */
export async function GET() {
  try {
    const items = await db
      .select()
      .from(webhooks)
      .orderBy(desc(webhooks.createdAt));

    await captureServerEvent("webhooks_list_requested", {
      count: items.length,
    });

    return NextResponse.json({ items, total: items.length });
  } catch (err: unknown) {
    console.error("GET /api/webhooks error", err);
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * Create a webhook endpoint
 * @summary Webhooks — Create Endpoint
 * @description Register a new endpoint that will receive signed POST deliveries for the subscribed events. Automatically generates a per-endpoint HMAC secret returned in the response.
 * @tag Webhooks
 * @contentType application/json
 * @body CreateWebhookBody
 * @response WebhookSchema
 * @examples request: {"url":"https://example.com/hooks/ds","events":["post.created","post.updated","post.deleted"]}
 * @examples response: {"id":"5f4e3d2c-1b0a-4987-6543-210fedcba987","url":"https://example.com/hooks/ds","events":["post.created","post.updated","post.deleted"],"secret":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","active":true,"lastStatus":null,"lastAttemptAt":null,"failureCount":0,"createdAt":"2026-08-23T09:00:00.000Z","updatedAt":"2026-08-23T09:00:00.000Z"}
 * @openapi
 */
export async function POST(req: NextRequest) {
  const authResponse = requireApiKeyAuth(req);
  if (authResponse) {
    return authResponse;
  }

  if (isDemoMode()) {
    return NextResponse.json(
      { error: "Read-only demo mode is active" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const parsed = CreateWebhookBody.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }

    const [hook] = await db
      .insert(webhooks)
      .values({
        id: randomUUID(),
        url: parsed.data.url,
        events: [...parsed.data.events],
        secret: newWebhookSecret(),
      })
      .returning();

    await captureServerEvent("webhook_created", {
      webhook_id: hook.id,
      events: hook.events,
    });

    return NextResponse.json(hook, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/webhooks error", err);
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}