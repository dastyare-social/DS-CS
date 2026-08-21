<h1 align="center">Dastyare Social — CS</h1>

<p align="center">
  Get free of the algorithm. Focus on getting leads and making money.
</p>

<p align="center">
  <a href="https://github.com/dastyare-social/DS-CS/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License"></a>
  <a href="https://github.com/dastyare-social/DS-CS/stargazers"><img src="https://img.shields.io/github/stars/dastyare-social/DS-CS?style=social" alt="Stars"></a>
  <a href="https://github.com/dastyare-social/DS-CS/actions"><img src="https://img.shields.io/github/actions/workflow/status/dastyare-social/DS-CS/ci.yml" alt="CI"></a>
</p>

<p align="center">
  <a href="#getting-started">Get Started</a> · <a href="https://github.com/dastyare-social/DS-CS">View on GitHub</a> · <a href="./docs/posthog-dashboard-guide.md">Analytics</a>
</p>

---

Every post you publish should work for you — not pad someone else's engagement numbers. DS-CS puts your content where real buyers and search engines actually find it, answering to you, not a feed algorithm.

- Get found by the people actually looking for what you do — not buried by an algorithm's mood swings
- Nothing you post can be taken down, demonetized, or buried by a policy change overnight
- Every post keeps working for you long after it's published — indexed, searchable, and referenceable, not gone in a day

---

## The Problem

Post on a platform you don't own, and the reach you build isn't really yours — one algorithm update, policy change, or suspension away from zero, no matter how good the content was.

DS-CS keeps that reach working for you instead: your content stays discoverable, stays yours, and keeps bringing people to your business on its own terms — not whenever a feed decides to show it.

---

## What You Get

### Publish in whatever form actually fits what you're saying

Text, image, video, voice, or file — each one published in the format that reads best, not squeezed into one mixed-up post trying to do everything at once.

### Ready for how people actually look things up now

More people are asking AI for recommendations instead of scrolling a feed. DS-CS makes sure your content is ready for that shift already — indexed for search engines and structured so AI agents can find and reference it, not just human eyes scrolling past.

### No policy change can touch what you've built

No surprise suspension, no algorithm update, no policy change can reach it — it runs on your own server, under your control, on standard tooling you actually own.

---

## Nothing Hidden

DS-CS is genuinely open-source — no license fee, no paid tier hiding the functionality you actually need. Inspect the code, self-host it, modify it, and never wonder if the free version is secretly the limited one. It's the one piece of the Dastyare Social suite built fully open, on purpose.

---

## Getting Started

**Step 1 — Deploy**

Docker multi-stage build, standard self-hosting setup.

```bash
git clone https://github.com/dastyare-social/DS-CS.git
cd DS-CS
docker compose up -d --build
```

**Step 2 — Bootstrap your admin account**

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`, and your account is ready on first build.

**Step 3 — Start publishing**

Post through the UI or the REST API directly — built for both from day one.

Open [http://localhost:8729](http://localhost:8729).

---

## Self-Hosting

### Environment Variables

Copy `.env.example` to `.env` and fill in the values:

<details>
<summary><strong>Database</strong></summary>

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |

</details>

<details>
<summary><strong>Auth & Admin</strong></summary>

| Variable | Description | Required |
|----------|-------------|----------|
| `ADMIN_EMAIL` | Admin email for bootstrap and login | Yes |
| `ADMIN_PASSWORD` | Admin password (strong recommended) | Yes |
| `BETTER_AUTH_URL` | Public app URL (e.g. `https://app.example.com`) | Yes |
| `BETTER_AUTH_SECRET` | Random secret for session signing (`openssl rand -base64 32`) | Yes |
| `API_KEY` | Shared API key for REST endpoints (`openssl rand -hex 32`) | Yes |

</details>

<details>
<summary><strong>S3 Storage</strong></summary>

| Variable | Description | Required |
|----------|-------------|----------|
| `S3_ENDPOINT` | S3 endpoint (AWS, DigitalOcean, MinIO) | Yes |
| `S3_REGION` | Storage region | Yes |
| `S3_ACCESS_KEY_ID` | Access key | Yes |
| `S3_SECRET_ACCESS_KEY` | Secret key | Yes |
| `S3_BUCKET_NAME` | Bucket name | Yes |
| `S3_FORCE_PATH_STYLE` | `true` for MinIO, `false` for AWS | Yes |

</details>

<details>
<summary><strong>App & Frontend</strong></summary>

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_APP_URL` | Public app URL for metadata and links | Yes |
| `NEXT_PUBLIC_ANIMATED_EMOJIES` | Enable animated emoji overlays | No |
| `NEXT_PUBLIC_ALLOW_INDEXING` | Allow search engine indexing | No |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | PostHog project token (analytics) | No |

</details>

<details>
<summary><strong>Push Notifications</strong></summary>

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY` | VAPID public key | No |
| `WEBPUSH_PRIVATE_KEY` | VAPID private key | No |
| `WEBPUSH_SUBJECT` | Contact URI (e.g. `mailto:you@example.com`) | No |

Generate VAPID keys: `npx web-push generate-vapid-keys`

</details>

<details>
<summary><strong>URL Shortener (Optional)</strong></summary>

| Variable | Description | Required |
|----------|-------------|----------|
| `DS_SH_URL` | Dastyare Social SH instance URL | No |
| `DS_SH_API_KEY` | API key for the URL shortener | No |

</details>

### App Configuration

Edit `config/app.config.yml` to set your name, description, and email, then regenerate:

```bash
bun run generate:config
```

---

## SEO & Search Console

Indexing is **disabled by default**. To enable:

1. Set `NEXT_PUBLIC_ALLOW_INDEXING=true` in production
2. Verify ownership in Google Search Console using one of:
   - **Meta tag:** set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` to your token
   - **File:** set `NEXT_PUBLIC_ENABLE_SEARCH_CONSOLE=true` — the app serves the verification file at `https://<your-host>/<filename>`
3. Submit `/sitemap.xml` in Search Console

Every post is indexed for search engines and includes an `llms.txt` site map for AI agents — built to be found, not just technically accessible.

---

## FAQ

**Is this actually free, or is there a paid tier?**
Open-source, no license required. There's no hidden paid tier — DS-CS itself is complete as-is.

**Do I need the rest of the Dastyare Social suite to use this?**
No. DS-CS runs standalone.

**What if I want the full personal brand build — website, content hub, everything?**
That's the Launch Package. DS-CS is one piece; the Launch Package bundles it with the rest.

**Does this support MCP for AI agent tool use?**
Yes. The app exposes an MCP server at `/api/mcp` so AI agents can call posts and stories as tools.

**What database and stack does this run on?**
Next.js, React, Bun, PostgreSQL, Drizzle ORM — full details in the docs.

**Is my content actually searchable, or just technically public?**
Every post is indexed for search engines and includes an `llms.txt` site map for AI agents — built to be found, not just technically accessible.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, coding conventions, and PR guidelines.

---

## Security

Report vulnerabilities via [GitHub Security Advisories](https://github.com/dastyare-social/DS-CS/security/advisories).

See [SECURITY.md](./SECURITY.md) for details.

---

## License

[MIT](LICENSE) — Copyright (c) 2026 Dastyare Social
