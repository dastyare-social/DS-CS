"use client";

import { useMemo, useState, useEffect } from "react";
import { checkPushSubscription, togglePushSubscription } from "@/lib/notifications/client";
import { getPushStatusMessage, type PushStatus } from "@/lib/notifications/status";
import { Button } from "../button";
import { isRunningAsPWA, getPWAInstallInstructions } from "@/lib/utils/pwa";

const NotifModal = () => {
  const [status, setStatus] = useState<PushStatus>("idle");
  const [isPWA, setIsPWA] = useState(false);
  const [installInstructions, setInstallInstructions] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    const initializeModal = async () => {
      // Check if running as PWA
      const pwaStatus = isRunningAsPWA();
      setIsPWA(pwaStatus);
      
      if (!pwaStatus) {
        setStatus("not-pwa");
        setInstallInstructions(getPWAInstallInstructions());
      } else {
        // Check if already subscribed
        const subscribed = await checkPushSubscription();
        setIsSubscribed(subscribed);
        setStatus(subscribed ? "enabled" : "idle");
      }
    };

    initializeModal();
    
    // Re-check on resize (might affect PWA detection on some devices)
    const handleResize = () => {
      const pwaStatus = isRunningAsPWA();
      setIsPWA(pwaStatus);
      
      if (!pwaStatus) {
        setStatus("not-pwa");
        setInstallInstructions(getPWAInstallInstructions());
      }
    };
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleToggle = async () => {
    // If not PWA, don't allow toggling notifications
    if (!isPWA) {
      return;
    }

    setStatus("loading");
    try {
      const result = await togglePushSubscription();
      
      if (result === "unsupported-browser") {
        setStatus("unsupported-browser");
      } else if (result === "permission-denied") {
        setStatus("permission-denied");
      } else if (result === "missing-vapid") {
        setStatus("missing-vapid");
      } else if (result === "not-pwa") {
        setStatus("not-pwa");
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
    if (!isPWA) return "Install App First";
    if (status === "loading") return isSubscribed ? "Turning Off ..." : "Enabling ...";
    if (isSubscribed) return "Turn Off Notifications";
    if (status === "unsupported-browser") return "Use a supported browser";
    if (status === "permission-denied") return "Allow Notifications";
    if (status === "missing-vapid") return "Setup required";
    if (status === "not-pwa") return "Install App First";
    if (status === "error") return "Try again";
    return "Enable Notifications";
  };

  const getButtonVariant = () => {
    if (!isPWA) return "secondary";
    return isSubscribed ? "secondary" : "primary";
  };

  return (
    <div className="flex flex-col justify-center items-center gap-y-2.5 py-6 px-6 w-xs border border-secondary/5 min-h-70 rounded-3xl bg-background/50 backdrop-blur-3xl">
      <div className="flex flex-1 flex-col w-full justify-start gap-y-2">
        <div className="text-lg font-medium">
          Stay Updated with <span className="text-primary">Fresh Posts and Stories</span>
        </div>
        <div className="text-sm opacity-80">
          {isPWA 
            ? "Turn on browser notifications to receive instant alerts when new content goes live."
            : "To get notifications, first install this app to your home screen."
          }
        </div>
        
        <div className="text-sm text-foreground/70">{helperText}</div>

        {/* Show installation guide when not in PWA mode */}
        {!isPWA && (
          <div className="mt-4 p-4 bg-primary/[3%] border border-primary/5">
            <div className="text-sm mb-2">— How to Install the App</div>
            <div className="text-sm text-foreground/80 mb-3">
              {installInstructions}
            </div>
            <div className="text-xs text-foreground/60">
              After installing to your home screen, reopen the app and enable notifications here.
            </div>
          </div>
        )}
      </div>

      <Button
        variant={getButtonVariant()}
        className="w-full text-sm md:text-sm"
        onClick={handleToggle}
        disabled={!isPWA || status === "loading"}
      >
        {getButtonText()}
      </Button>
    </div>
  );
};

export default NotifModal;