import { app_config, app_url } from '@/config/app';

export default function Head() {
  const verificationEnabled = process.env.NEXT_PUBLIC_ENABLE_SEARCH_CONSOLE === 'true'
  const verification = verificationEnabled ? (process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || process.env.GOOGLE_SITE_VERIFICATION) : undefined;
  const locale = process.env.NEXT_PUBLIC_LOCALE || 'en';

  const siteName = app_config[locale]?.name || app_config.en.name;
  const siteDesc = app_config[locale]?.desc || app_config.en.desc;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "url": app_url,
    "name": siteName,
    "description": siteDesc,
    "publisher": {
      "@type": "Organization",
      "name": siteName,
      "email": app_config.general?.email,
      "url": app_url
    }
  };

  return (
    <>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      {verification ? (
        <meta name="google-site-verification" content={verification} />
      ) : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
