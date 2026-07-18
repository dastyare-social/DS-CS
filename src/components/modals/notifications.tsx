"use client";

import { useMemo, useState } from "react";
import { registerPushSubscription } from "@/lib/notifications/client";
import { getPushStatusMessage, type PushStatus } from "@/lib/notifications/status";
import { Button } from "../button";

const NotifModal = () => {
  const [status, setStatus] = useState<PushStatus>("idle");

  const handleSubscribe = async () => {
    setStatus("loading");
    try {
      const result = await registerPushSubscription();
      if (result === "unsupported-browser") {
        setStatus("unsupported-browser");
      } else if (result === "permission-denied") {
        setStatus("permission-denied");
      } else if (result === "missing-vapid") {
        setStatus("missing-vapid");
      } else if (result) {
        setStatus("enabled");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const helperText = useMemo(() => getPushStatusMessage(status), [status]);

  return (
    <div className="flex flex-col justify-center items-center gap-y-2.5 py-6 px-6 w-xs border border-secondary/5 min-h-70 rounded-3xl bg-background/50 backdrop-blur-3xl">
      <div className="flex flex-1 flex-col w-full justify-start gap-y-2">
        <div className="text-lg font-medium">
          Stay updated with <span className="text-primary">fresh posts and stories</span>
        </div>
        <div className="text-sm opacity-80">
          Turn on browser notifications to receive instant alerts when new content goes live.
        </div>
        <div className="text-sm text-foreground/70">{helperText}</div>
      </div>

      <Button
        variant="primary"
        className="w-full text-sm md:text-sm"
        onClick={handleSubscribe}
        disabled={status === "loading"}
      >
        {status === "loading"
          ? "Enabling..."
          : status === "enabled"
            ? "Notifications On"
            : status === "unsupported-browser"
              ? "Use a supported browser"
              : status === "permission-denied"
                ? "Allow notifications"
                : status === "missing-vapid"
                  ? "Setup required"
                  : status === "error"
                    ? "Try again"
                    : "Enable notifications"}
      </Button>
    </div>
  );
};

export default NotifModal;
