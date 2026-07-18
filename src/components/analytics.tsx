"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth/client";
import { captureClientEvent, identifyClient } from "@/lib/analytics/client";

type AnalyticsUser = {
  id?: string;
  email?: string;
  name?: string;
  image?: string | null;
  username?: string;
};

type AnalyticsSession = {
  user?: AnalyticsUser | null;
};

const getSessionIdentity = (session: AnalyticsSession | null) => {
  if (!session || typeof session !== "object") return null;
  const user = session.user;
  if (!user || typeof user !== "object") return null;
  if (typeof user.id === "string" && user.id) {
    return user.id;
  }
  if (typeof user.email === "string" && user.email) {
    return user.email;
  }
  return null;
};

export default function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const session = useSession();

  useEffect(() => {
    const identity = getSessionIdentity(session.data);
    if (identity) {
      const user = session.data?.user as AnalyticsUser | undefined;
      const props: Record<string, unknown> = {
        email: user?.email,
        name: user?.name,
      };

      if (user && typeof user.username === "string") {
        props.username = user.username;
      }

      void identifyClient(identity, props);
    }
  }, [session.data]);

  useEffect(() => {
    const query = searchParams.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    void captureClientEvent("page_view", {
      path,
      title: document.title,
      locale: navigator.language || "unknown",
      page_type: pathname.startsWith("/docs") ? "docs" : pathname === "/openapi.json" ? "openapi" : pathname === "/llms.txt" ? "llms" : "app",
      referrer: document.referrer || "direct",
    });
  }, [pathname, searchParams]);

  return null;
}
