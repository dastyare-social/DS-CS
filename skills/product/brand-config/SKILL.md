---
name: brand-config
description: Configure a DS-CS channel's identity — username, name, description, the /about resume page, and the profile image. Use when rebranding a channel, editing config/app.config.yml or config/about.config.yml, toggling the about page, or when someone asks to change the site name or bio. Changes apply on save with no rebuild or restart.
---

# Branding a channel

## The live-edit model

Three files control the channel's identity:

| File | Controls | Applied by |
|---|---|---|
| `config/app.config.yml` | Username, email, channel name, description, meta, header, profile | reload the page |
| `config/about.config.yml` | The `/about` page — enabled flag, bio, contacts, work/education sections | refresh `/about` |
| `public/profile-image.png` | The channel avatar | reload |

All three are read from disk on **every request**. Save the file, reload the browser, and the change is live. **No rebuild. No `docker compose restart`.** Hard-refresh to bypass caching.

`docker-compose.yml` bind-mounts the whole `./config` directory rather than individual files, so editors that save via atomic rename (VS Code, most others) cannot orphan the inode the container is watching.

## app.config.yml

```yaml
general:
  username: "omidshabab"
  email: "hey@example.com"

en:
  name: "Your Name"
  desc: "Short description used in meta tags and on the /about page."
```

`general.username` is the account handle. `general.email` is the contact shown in the footer and contact links. Each locale key (`en`, and any others you add) carries `name` and `desc`; `name` drives the browser tab, the header, and SEO, and `desc` drives meta tags and `/about`.

This file is compiled to `config/app.config.json` at build time by `bun run generate:config`, and the JSON twin is what the client bundle imports. The runtime editor path re-reads the YAML on each request, which is what makes live edits work without a rebuild.

## about.config.yml

The first key **must** be `enabled:`, and `general.name` must be non-empty — the API enforces both.

```yaml
enabled: true
general:
  name: "Your Name"
  jobTitle: "Builder"
  website: "https://example.com"
  about: "A longer bio."
  contacts:
    - label: "Email"
      value: "you@example.com"
content:
  - title: "Work Experience"
    items:
      - title: "Role"
        company: "Company"
        period: "2024 — present"
        description: "What you did."
  - title: "Education"
    items:
      - title: "Degree"
        school: "University"
        period: "2020 — 2024"
```

When `enabled` is false, `/about` renders the not-found page and leaves the sitemap. **All other data is preserved** — toggling visibility is a one-key flip, not a rewrite.

### Via the API or MCP

```bash
# read the current config
curl https://cs.example.com/api/...   # or use the get_resume_config MCP tool

# toggle visibility without touching content — preferred
#   MCP tool: set_resume_enabled { "enabled": false }
```

`update_resume_config` replaces the **whole file** from a YAML string, so read the current config first and edit it — a blind overwrite silently discards every section. `set_resume_enabled` is the safe operation for visibility: it flips one key and preserves everything else.

## Profile image

Replace `public/profile-image.png` in place. It is served at `/profile-image.png` with `no-store`, your file wins over the baked default, and if the file is missing at startup the default is seeded in so the URL always resolves. `docker compose up` never copies over it.

## Verify

```bash
docker compose logs -f app      # config parse errors surface here
```

Then reload the site and `/about`. If a change did not appear, the YAML is the thing to suspect first — an indentation error or a missing `general.name` makes the config fall back rather than crash, which reads as "my edit did nothing".

## Mistakes that cost time

- Restarting Docker after a config edit. Unnecessary, and it hides the real problem.
- Putting `enabled:` anywhere but the first line of `about.config.yml` — the API rejects it.
- Calling `update_resume_config` with a partial document and wiping the resume.
- Editing `config/app.config.json` directly. It is generated; the YAML is the source of truth and your edit is overwritten on the next `generate:config`.
- Replacing `profile-image.png` with a different filename. The route serves that exact path.
