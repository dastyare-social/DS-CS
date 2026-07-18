const { chromium } = require("playwright");
const url = process.env.PWA_SELF_TEST_URL || "http://localhost:8729";

const assert = (name, condition, detail) => {
  if (!condition) {
    throw new Error(`${name} failed${detail ? `: ${detail}` : ""}`);
  }
  console.log(`✅ ${name}`);
};

(async () => {
  console.log(`Starting PWA self-test against ${url}`);

  const manifestUrl = `${url}/manifest.webmanifest`;
  const swUrl = `${url}/sw.js`;

  const fetchManifest = await fetch(manifestUrl);
  assert("manifest.webmanifest reachable", fetchManifest.ok, `status ${fetchManifest.status}`);

  const manifest = await fetchManifest.json();
  assert("manifest contains name", Boolean(manifest.name));
  assert("manifest contains short_name", Boolean(manifest.short_name));
  assert("manifest display is standalone", manifest.display === "standalone" || manifest.display === "fullscreen", `got ${manifest.display}`);
  assert("manifest has icons", Array.isArray(manifest.icons) && manifest.icons.length > 0);

  const fetchSw = await fetch(swUrl);
  assert("sw.js reachable", fetchSw.ok, `status ${fetchSw.status}`);
  const swText = await fetchSw.text();
  assert("sw.js contains service worker code", swText.includes("self.addEventListener") || swText.includes("addEventListener("), "no service worker hooks found");

  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  const swSupported = await page.evaluate(() => "serviceWorker" in navigator);
  assert("service worker supported in browser", swSupported);

  const registered = await page.evaluate(async () => {
    if (!navigator.serviceWorker) return false;
    const getRegistration = async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return !!reg;
    };
    const timeout = 15000;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await getRegistration()) return true;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return false;
  });
  assert("service worker registered", registered);

  const hasOfflinePage = await page.goto(`${url}/~offline`, { waitUntil: "domcontentloaded", timeout: 60000 });
  assert("offline fallback page reachable", hasOfflinePage.ok, `status ${hasOfflinePage.status}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  const selfTestPage = await page.goto(`${url}/pwa-self-test`, { waitUntil: "domcontentloaded", timeout: 60000 });
  assert("self-test page reachable", selfTestPage.ok, `status ${selfTestPage.status}`);

  const selfTestStatus = await page.evaluate(() => {
    const entries = Array.from(document.querySelectorAll("div > div.font-medium, div > div.text-green-600, div > div.text-red-600"));
    return entries.length > 0;
  });
  assert("self-test page rendered checks", selfTestStatus);

  await browser.close();

  console.log("PWA self-test complete.");
  process.exit(0);
})().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
