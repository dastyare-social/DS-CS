import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema/push-subscriptions";
import { eq } from "drizzle-orm";
import { captureServerEvent } from "@/lib/analytics/server";
import { z } from "zod";

const pushSubscriptionRequestSchema = z.object({
  endpoint: z.string(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

/** @id PushSubscriptionResponse */
const PushSubscriptionResponse = z.object({
  success: z.boolean(),
});

/**
 * Save a browser push subscription
 * @description Register or update a push subscription for the current browser. Requires `endpoint` and `keys.p256dh` / `keys.auth`.
 * @tag Push
 * @body pushSubscriptionRequestSchema
 * @response PushSubscriptionResponse
 * @contentType application/json
 * @openapi
 */
export async function POST(req: NextRequest) {
  try {
    const jsonBody = await req.json().catch(() => null);
    const parseResult = pushSubscriptionRequestSchema.safeParse(jsonBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid subscription payload" },
        { status: 400 }
      );
    }

    const { endpoint, keys } = parseResult.data;
    const p256dh = keys.p256dh;
    const auth = keys.auth;

    if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
      return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .limit(1);

    const now = new Date();

    if (existing.length) {
      await db
        .update(pushSubscriptions)
        .set({
          p256dh,
          auth,
          userAgent: req.headers.get("user-agent") ?? null,
          active: true,
          updatedAt: now,
        })
        .where(eq(pushSubscriptions.id, existing[0].id));
    } else {
      await db.insert(pushSubscriptions).values({
        id: randomUUID(),
        endpoint,
        p256dh,
        auth,
        userAgent: req.headers.get("user-agent") ?? null,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    await captureServerEvent("push_subscription_saved", {
      endpoint,
      active: true,
      user_agent: req.headers.get("user-agent") ?? null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("push subscription save failed", error);
    await captureServerEvent("push_subscription_failed", {
      error: String(error),
    });
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }
}
