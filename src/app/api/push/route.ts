import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema/push-subscriptions";
import { eq } from "drizzle-orm";
import { captureServerEvent } from "@/lib/analytics/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const auth = body?.keys?.auth;

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
