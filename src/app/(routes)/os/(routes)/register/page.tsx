"use client";

import { Button } from "@/components/button";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Field, FieldGroup } from "@/components/field";
import { Input } from "@/components/input";
import { signIn } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import { routes } from "@/config/routes";

const Page = () => {
  const t = useTranslations();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show_password_input, set_show_password_input] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Root scroll container ref (optional but useful for future scroll-to-bottom logic)
  const pageRef = useRef<HTMLDivElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  // The hidden password field still lays out at its natural height, so it can
  // be measured while collapsed and its exact height animated on reveal.
  const passwordFieldRef = useRef<HTMLDivElement | null>(null);

  const [pageHeight, setPageHeight] = useState<number | null>(null);
  const [passwordFieldHeight, setPasswordFieldHeight] = useState(0);

  const updatePageHeight = () => {
    setPageHeight(window.innerHeight);
  };

  useEffect(() => {
    updatePageHeight(); // initial
    window.addEventListener("resize", updatePageHeight);
    return () => window.removeEventListener("resize", updatePageHeight);
  }, []);

  useEffect(() => {
    const field = passwordFieldRef.current;
    if (field) setPasswordFieldHeight(field.scrollHeight);
  }, []);

  // Handle "Continue" click – validate email and reveal password
  const handleContinue = () => {
    if (!email.trim()) {
      setError(t("general.email_required"));
      return;
    }
    setError(null);
    set_show_password_input(true);
  };

  // Auto-focus password input when it becomes visible
  useEffect(() => {
    if (show_password_input && passwordRef.current) {
      passwordRef.current.focus();
    }
  }, [show_password_input]);

  // Handle final sign-in
  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError(t("general.all_fields_required"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: signInError } = await signIn.email({
        email: email.trim(),
        password: password.trim(),
        // Optional: rememberMe: true,
        // Optionally provide a callback URL; Better Auth will redirect there on success
        callbackURL: routes.os, // change to your dashboard or home page
        rememberMe: true,
      });

      if (signInError) {
        // Better Auth returns an error object with a message
        throw new Error(signInError.message || t("general.login_error"));
      }

      // If no error and no redirect happened (e.g., callbackURL not used),
      // manually redirect to the desired page.
      // Usually Better Auth handles the redirect when callbackURL is provided,
      // but we add a safety net.
      // if (data && !signInError) {
      //   // In case the callback didn't trigger a redirect, we do it ourselves.
      //   window.location.href = "/os"; // or use Next.js router
      // }
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : t("general.login_error"),
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key on inputs
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (show_password_input) {
        handleSignIn();
      } else {
        handleContinue();
      }
    }
  };

  return (
    <div
      ref={pageRef}
      style={{ height: `${pageHeight}px` }}
      className="flex items-center justify-center"
    >
      <div className="flex flex-col gap-y-6 px-6 w-sm tracking-[-1.5px]">
        <div className="flex flex-col gap-y-2">
          <div className="text-[25px] leading-8">
            {t("general.login_panel_title")} &nbsp;
            <span className="text-primary">
              — {t("general.login_panel_title_span")}
            </span>
          </div>
          <div className="text-[20px] opacity-80">
            — {t("general.login_panel_subtitle")}
          </div>
        </div>

        <FieldGroup className="w-full gap-y-1.5">
          {/* —— EMAIL ADDRESS INPUT —— */}
          <Field className="flex flex-col gap-y-0.5">
            <div className="pl-5 text-sm tracking-[-0.8px] text-secondary/60">
              email address —
            </div>
            <Input
              id="fieldgroup-email"
              type="email"
              placeholder="hey@dastyare.social"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              autoFocus
            />
          </Field>

          {/* —— PASSWORD STEP with measured reveal —— */}
          {/* Height animates to the field's measured value — no `max-h-0`
              guess and no `transition-all` sweeping properties that were never
              meant to move. The field fades in and drifts up on the same
              260ms curve as SPACE's step swap; reduced motion drops the drift,
              snaps the height and shortens the fade. `inert` keeps the
              collapsed field out of the tab order. */}
          <div
            inert={!show_password_input}
            aria-hidden={!show_password_input}
            style={{
              height: show_password_input ? passwordFieldHeight : 0,
            }}
            className="overflow-hidden transition-[height] duration-[260ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
          >
            <div
              ref={passwordFieldRef}
              className={cn(
                // `pt-2` restores the wider step spacing inside the measured
                // height, so the gap opens with the field instead of jumping.
                "pt-2 transition-[opacity,translate] duration-[260ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:duration-150 motion-reduce:translate-y-0",
                show_password_input
                  ? "translate-y-0 opacity-100"
                  : "translate-y-2 opacity-0",
              )}
            >
              <Field className="flex flex-col gap-y-0.5">
                <div className="pl-5 text-sm tracking-[-0.8px] text-secondary/60">
                  password —
                </div>
                <Input
                  ref={passwordRef}
                  id="fieldgroup-password"
                  type="password"
                  placeholder="YOUR-PASSWORD*"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                />
              </Field>
            </div>
          </div>

          {error && (
            <div className="text-sm tracking-[-0.8px] text-primary pl-5 -mt-2">
              {error}
            </div>
          )}

          <Field orientation="horizontal">
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              onClick={() => {
                if (show_password_input) {
                  handleSignIn();
                } else {
                  handleContinue();
                }
              }}
              className="w-full mt-2.5"
            >
              {/* Both labels stay mounted in one grid cell and cross-fade, so
                  the swap neither reflows the button nor reads as a sudden
                  replacement. The inactive label is hidden from assistive
                  tech so the button has exactly one name at a time. */}
              <span className="grid">
                <span
                  aria-hidden={show_password_input}
                  className={cn(
                    "col-start-1 row-start-1 transition-opacity duration-[260ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:duration-150",
                    show_password_input ? "opacity-0" : "opacity-100",
                  )}
                >
                  continue —
                </span>
                <span
                  aria-hidden={!show_password_input}
                  className={cn(
                    "col-start-1 row-start-1 transition-opacity duration-[260ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:duration-150",
                    show_password_input ? "opacity-100" : "opacity-0",
                  )}
                >
                  {t("general.login_to_panel")}
                </span>
              </span>
            </Button>
          </Field>
        </FieldGroup>
      </div>
    </div>
  );
};

export default Page;
