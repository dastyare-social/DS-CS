import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema/push-subscriptions";
import { eq } from "drizzle-orm";
import { captureServerEvent } from "@/lib/analytics/server";

/**
 * Check if a push subscription is active
 * @description Check the status of a push subscription by endpoint
 * @tag Push
 * @query endpoint - The subscription endpoint to check
 * @response { active: boolean }
 * @openapi
 */
export async function GET(req: NextRequest) {
  try {
    const endpoint = req.nextUrl.searchParams.get("endpoint");
    
    if (!endpoint) {
      return NextResponse.json(
        { error: "Endpoint query parameter is required" },
        { status: 400 }
      );
    }

    const subscription = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .limit(1);

    const active = subscription.length > 0 && subscription[0].active === true;

    await captureServerEvent("push_subscription_checked", {
      endpoint,
      active,
    });

    return NextResponse.json({ active });
  } catch (error) {
    console.error("Failed to check subscription status:", error);
    return NextResponse.json({ active: false });
  }
}