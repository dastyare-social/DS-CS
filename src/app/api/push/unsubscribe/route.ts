import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema/push-subscriptions";
import { eq } from "drizzle-orm";
import { captureServerEvent } from "@/lib/analytics/server";
import { z } from "zod";

const unsubscribeRequestSchema = z.object({
  endpoint: z.string(),
});

/**
 * Mark a push subscription as inactive
 * @description Unsubscribe from push notifications by marking subscription as inactive
 * @tag Push
 * @body unsubscribeRequestSchema
 * @response { success: boolean }
 * @contentType application/json
 * @openapi
 */
export async function POST(req: NextRequest) {
  try {
    const jsonBody = await req.json().catch(() => null);
    const parseResult = unsubscribeRequestSchema.safeParse(jsonBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request payload" },
        { status: 400 }
      );
    }

    const { endpoint } = parseResult.data;

    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .limit(1);

    if (existing.length) {
      await db
        .update(pushSubscriptions)
        .set({
          active: false,
          updatedAt: new Date(),
        })
        .where(eq(pushSubscriptions.id, existing[0].id));

      await captureServerEvent("push_subscription_disabled", {
        endpoint,
      });

      return NextResponse.json({ success: true });
    } else {
      // Subscription not found in database, but that's okay
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error("Failed to unsubscribe:", error);
    await captureServerEvent("push_subscription_unsubscribe_failed", {
      error: String(error),
    });
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }
}