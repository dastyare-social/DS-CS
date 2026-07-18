import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema/push-subscriptions";
import { requireApiKeyAuth } from "@/lib/auth/api-key";
import { eq } from "drizzle-orm";
import type { PushSubscription } from "web-push";
import webPush from "web-push";
import { configureWebPush } from "@/lib/notifications/push";

export async function POST(req: NextRequest) {
  const authResponse = requireApiKeyAuth(req);
  if (authResponse) {
    return authResponse;
  }

  try {
    const body = await req.json();
    const title = typeof body?.title === "string" ? body.title : "New update";
    const bodyText = typeof body?.body === "string" ? body.body : "A new update is available";
    const url = typeof body?.url === "string" ? body.url : "/";

    const configured = configureWebPush();
    if (!configured) {
      return NextResponse.json({ success: false, skipped: true, reason: "push-not-configured" });
    }

    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.active, true));

    const payload = JSON.stringify({
      title,
      body: bodyText,
      url,
      icon: "/profile_image.png",
    });

    const results = await Promise.allSettled(
      subscriptions.map((subscription) =>
        webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          } as PushSubscription,
          payload,
        ),
      ),
    );

    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length) {
      console.warn("Some push notifications failed", failed.length);
    }

    return NextResponse.json({ success: true, sent: results.length - failed.length, failed: failed.length });
  } catch (error) {
    console.error("push send failed", error);
    return NextResponse.json({ error: "Failed to send push notifications" }, { status: 500 });
  }
}
