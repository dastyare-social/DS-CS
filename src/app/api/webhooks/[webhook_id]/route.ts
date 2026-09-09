import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { webhooks } from "@/lib/db/schema/webhooks";
import { captureServerEvent } from "@/lib/analytics/server";
import { requireApiKeyAuth } from "@/lib/auth/api-key";
import { isDemoMode } from "@/lib/demo-mode";
import { WEBHOOK_EVENTS } from "@/lib/webhooks";

type RouteParams = {
  params: Promise<{
    webhook_id: string;
  }>;
};

/** @id WebhookParams */
export const WebhookParams = z.object({
  webhook_id: z.string(),
});

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

/** @id UpdateWebhookBody */
export const UpdateWebhookBody = z.object({
  url: z.string().url().optional(),
  events: z.array(WebhookEventInput).min(1).optional(),
  active: z.boolean().optional(),
});

/** @id WebhookSuccessResponse */
export const WebhookSuccessResponse = z.object({
  success: z.boolean(),
});

export const dynamic = "force-dynamic";

/**
 * Get webhook by ID
 * @summary Webhooks — Get Endpoint by ID
 * @description Returns a single registered webhook endpoint with its subscribed events, secret, and delivery status.
 * @tag Webhooks
 * @pathParams WebhookParams
 * @response WebhookSchema
 * @examples response: {"id":"5f4e3d2c-1b0a-4987-6543-210fedcba987","url":"https://example.com/hooks/ds","events":["post.created","story.created"],"secret":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","active":true,"lastStatus":"ok","lastAttemptAt":"2026-08-23T10:15:00.000Z","failureCount":0,"createdAt":"2026-08-23T09:00:00.000Z","updatedAt":"2026-08-23T10:15:00.000Z"}
 * @openapi
 */
export async function GET(req: NextRequest, context: RouteParams) {
  const { webhook_id } = await context.params;

  try {
    const [hook] = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, webhook_id));

    if (!hook) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await captureServerEvent("webhook_requested", {
      webhook_id: hook.id,
    });

    return NextResponse.json(hook);
  } catch (err: unknown) {
    console.error("GET /api/webhooks/[webhook_id] error", err);
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * Update webhook
 * @summary Webhooks — Update Endpoint
 * @description Partially update a webhook endpoint: URL, subscribed events, or active status. Passing active=false pauses deliveries without deleting the endpoint.
 * @tag Webhooks
 * @pathParams WebhookParams
 * @body UpdateWebhookBody
 * @response WebhookSchema
 * @examples request: {"active":false}
 * @examples response: {"id":"5f4e3d2c-1b0a-4987-6543-210fedcba987","url":"https://example.com/hooks/ds","events":["post.created","story.created"],"secret":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","active":false,"lastStatus":"ok","lastAttemptAt":"2026-08-23T10:15:00.000Z","failureCount":0,"createdAt":"2026-08-23T09:00:00.000Z","updatedAt":"2026-08-23T11:00:00.000Z"}
 * @openapi
 */
export async function PATCH(req: NextRequest, context: RouteParams) {
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

  const { webhook_id } = await context.params;

  try {
    const body = await req.json().catch(() => null);
    const parsed = UpdateWebhookBody.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }

    const patch = parsed.data;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "At least one field is required" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(webhooks)
      .set({
        ...(patch.url !== undefined && { url: patch.url }),
        ...(patch.events !== undefined && { events: [...patch.events] }),
        ...(patch.active !== undefined && { active: patch.active }),
      })
      .where(eq(webhooks.id, webhook_id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await captureServerEvent("webhook_updated", {
      webhook_id: updated.id,
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    console.error("PATCH /api/webhooks/[webhook_id] error", err);
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * Delete webhook
 * @summary Webhooks — Delete Endpoint
 * @description Permanently deletes a webhook endpoint and stops all future deliveries.
 * @tag Webhooks
 * @pathParams WebhookParams
 * @response WebhookSuccessResponse
 * @examples response: {"success":true,"id":"5f4e3d2c-1b0a-4987-6543-210fedcba987"}
 * @openapi
 */
export async function DELETE(req: NextRequest, context: RouteParams) {
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

  const { webhook_id } = await context.params;

  try {
    const [deleted] = await db
      .delete(webhooks)
      .where(eq(webhooks.id, webhook_id))
      .returning({ id: webhooks.id });

    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await captureServerEvent("webhook_deleted", {
      webhook_id: deleted.id,
    });

    return NextResponse.json({ success: true, id: deleted.id });
  } catch (err: unknown) {
    console.error("DELETE /api/webhooks/[webhook_id] error", err);
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}