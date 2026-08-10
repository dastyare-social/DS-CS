# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue for security vulnerabilities. Instead,
report them privately.

- **Email:** Create a private report on GitHub:
  https://github.com/omidshabab/dastyare_social_cs/security/advisories

When reporting, include as much of the following as possible:

- A short description of the vulnerability
- Steps to reproduce (including any configuration or environment details)
- Affected version(s)
- Impact and any suggested mitigation if known

You should receive a response within 5 business days. If the issue is
confirmed, we will coordinate a fix and a public disclosure timeline.

## Scope

The following are in scope:

- Authentication and authorization (Better Auth, API keys, sessions)
- The REST API (`/api/*`) and tRPC endpoints
- Media upload handling (S3, file type detection, sanitization)
- Push notification endpoints
- Deployment configuration (Docker, CI)

The following are **out of scope** and are expected to be configured by the
operator:

- Misconfigured environment variables / secrets in deployment
- Vulnerabilities in upstream dependencies — report those to their maintainers

## Supported versions

Security fixes are applied to the latest release. Backports to older releases
are handled on a case-by-case basis.

## General security guidance

- Never commit `.env` or real credentials
- Use strong, unique secrets (see `.env.example` for generators)
- Keep upstream dependencies up to date (`bun update`)
- Rotate API keys and Better Auth secrets periodically
