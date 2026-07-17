"use client";

import { cn } from "@/lib/utils";
import { Button } from "../button";
import Stories from "../stories";
import { pally } from "@/lib/fonts";
import { useLocale, useTranslations } from "next-intl";
import { app_config } from "@/config/app";
import { Locale } from "@/config/locale";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth/client";
import { useState } from "react";

const ProfileModal = ({ opened }: { opened?: boolean }) => {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Check if we are on a route that starts with "/os"
  const isOsRoute = pathname?.startsWith("/os") ?? false;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center gap-y-2.5 py-6 px-6 w-3xs border border-secondary/5 min-h-70 rounded-3xl bg-background/50 backdrop-blur-3xl">
      <div className="aspect-square mt-3 rounded-full border border-secondary/5 overflow-hidden">
        <Stories size={85} opened={opened} />
      </div>
      <div className="flex flex-1 flex-col w-full justify-start text-center">
        <div>{app_config[locale].name}</div>
        <div dir="ltr" className={cn("text-sm opacity-80", pally.className)}>
          @{app_config.general.username}
        </div>
        <div className="text-sm opacity-80 my-5 line-clamp-3">
          {app_config[locale].desc}
        </div>
      </div>

      {isOsRoute ? (
        <Button
          variant="primary"
          className="w-full text-sm md:text-sm"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          {t("general.logout")}
        </Button>
      ) : (
        <Button
          variant="primary"
          className="w-full text-sm md:text-sm"
          onClick={() => {
            // Open default email client with the recipient
            window.location.href = `mailto:${app_config.general.email}`;
            // Optional: add subject & body
            // const subject = encodeURIComponent("Hello");
            // const body = encodeURIComponent("I'd like to ask about...");
            // window.location.href = `mailto:${app_config.general.email}?subject=${subject}&body=${body}`;
          }}
        >
          {t("general.send_message_now")}
        </Button>
      )}
    </div>
  );
};

export default ProfileModal;