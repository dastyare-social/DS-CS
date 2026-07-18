"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Check = { name: string; ok: boolean | null; detail?: string };

export default function PwaSelfTest() {
  const [checks, setChecks] = useState<Check[]>([]);

  useEffect(() => {
    const results: Check[] = [];

    const push = (name: string, ok: boolean | null, detail?: string) => {
      results.push({ name, ok, detail });
      setChecks([...results]);
    };

    // Manifest
    fetch("/manifest.webmanifest")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        push("manifest.webmanifest reachable", true);
        return r.json();
      })
      .then((m) => push("manifest contains name", Boolean(m.name)))
      .catch((err) => push("manifest.webmanifest reachable", false, String(err)));

    // Service worker file
    fetch("/sw.js")
      .then((r) => push("/sw.js reachable", r.ok, `status ${r.status}`))
      .catch((err) => push("/sw.js reachable", false, String(err)));

    // Service worker registration and subscription
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        push("service worker registered", Boolean(reg));
        if (reg) {
          reg.pushManager
            .getSubscription()
            .then((s) => push("push subscription present", Boolean(s)))
            .catch((e) => push("push subscription present", false, String(e)));
        }
      });
    } else {
      push("service worker supported", false);
    }

    // Installability / display mode
    try {
      const isStandalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
      push("display-mode standalone", Boolean(isStandalone));
      push("navigator.standalone (iOS)", Boolean((navigator as any).standalone));
    } catch (e) {
      push("display-mode standalone", null, String(e));
    }

    // beforeinstallprompt presence
    push("beforeinstallprompt event available", typeof window !== "undefined" ? true : null);
  }, []);

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold">PWA Self-test</h1>
        <p className="text-sm text-gray-600 mt-2">Open this page in a browser and run the checks below.</p>

        <div className="mt-6 grid gap-2">
          {checks.length === 0 && <div className="text-sm text-gray-500">Running checks…</div>}
          {checks.map((c, i) => (
            <div key={i} className="p-3 bg-white rounded shadow-sm flex justify-between items-center">
              <div>
                <div className="font-medium">{c.name}</div>
                {c.detail && <div className="text-xs text-gray-500">{c.detail}</div>}
              </div>
              <div>
                {c.ok === null ? (
                  <span className="text-gray-500">—</span>
                ) : c.ok ? (
                  <span className="text-green-600">OK</span>
                ) : (
                  <span className="text-red-600">FAILED</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-2">
          <Link href="/">
            <a className="px-4 py-2 bg-primary text-white rounded">Open Home</a>
          </Link>
          <Link href="/~offline">
            <a className="px-4 py-2 bg-white border rounded">Open Offline Page</a>
          </Link>
        </div>
      </div>
    </div>
  );
}
