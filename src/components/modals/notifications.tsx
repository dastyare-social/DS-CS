"use client";

import { useMemo, useState, useEffect } from "react";
import { checkPushSubscription, togglePushSubscription } from "@/lib/notifications/client";
import { getPushStatusMessage, type PushStatus } from "@/lib/notifications/status";
import { Button } from "../button";

const NotifModal = () => {
  const [status, setStatus] = useState<PushStatus>("idle");
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    const initializeModal = async () => {
      // Check if already subscribed
      const subscribed = await checkPushSubscription();
      setIsSubscribed(subscribed);
      setStatus(subscribed ? "enabled" : "idle");
    };

    initializeModal();
  }, []);

  const handleToggle = async () => {
    setStatus("loading");
    try {
      const result = await togglePushSubscription();

      if (result === "unsupported-browser") {
        setStatus("unsupported-browser");
      } else if (result === "permission-denied") {
        setStatus("permission-denied");
      } else if (result === "missing-vapid") {
        setStatus("missing-vapid");
      } else if (result === "error") {
        setStatus("error");
      } else if (result === "enabled") {
        setStatus("enabled");
        setIsSubscribed(true);
      } else if (result === "idle") {
        setStatus("idle");
        setIsSubscribed(false);
      }
    } catch {
      setStatus("error");
    }
  };

  const helperText = useMemo(() => getPushStatusMessage(status), [status]);

  const getButtonText = () => {
    if (status === "loading") return isSubscribed ? "Turning Off ..." : "Enabling ...";
    if (isSubscribed) return "Turn Off Notifications";
    if (status === "unsupported-browser") return "Use a supported browser";
    if (status === "permission-denied") return "Allow Notifications";
    if (status === "missing-vapid") return "Setup required";
    if (status === "error") return "Try again";
    return "Enable Notifications";
  };

  const getButtonVariant = () => (isSubscribed ? "secondary" : "primary");

  return (
    <div className="flex flex-col justify-center items-center gap-y-2.5 py-6 px-6 w-xs border border-secondary/5 min-h-70 rounded-3xl bg-background/50 backdrop-blur-3xl">
      <div className="flex flex-1 flex-col w-full justify-start gap-y-2">
        <div className="text-lg font-medium">
          Stay Updated with <span className="text-primary">Fresh Posts and Stories</span>
        </div>
        <div className="text-sm opacity-80">
          Turn on browser notifications to receive instant alerts when new content goes live.
        </div>

        <div className="text-sm text-foreground/70">{helperText}</div>
      </div>

      <Button
        variant={getButtonVariant()}
        className="w-full text-sm md:text-sm"
        onClick={handleToggle}
        disabled={status === "loading"}
      >
        {getButtonText()}
      </Button>
    </div>
  );
};

export default NotifModal;
