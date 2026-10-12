---
name: release
description: Cut a DS-CS release — version bump in package.json, selective staging, commit, annotated tag, and push. Use whenever someone says "ship it", "release", "stage and push changes", "bump the version", or asks to publish a new version. Also covers what makes the in-app update banner fire.
---

# Cutting a release

## The rule that overrides everything

**"Stage and push changes" is a release, not a commit.** A bare commit is never the right response. A version bump is always included; never push without one.

## The sequence, in order

### 1. Review first

```bash
git status
git diff
git diff --cached
```

Decide what is actually being released and whether anything unrelated is in the working tree. You must be able to state this before touching the index.

### 2. Stage selectively

Stage only the files belonging to this change. If unrelated edits are present, leave them unstaged and **say so explicitly** — never sweep them in silently.

```bash
git add <specific paths>
git status   # confirm what is actually staged
```

### 3. Bump the version

Read the current version from `package.json` — it is the source of truth.

```bash
npm version patch   # or minor / major
```

`next.config.ts` bakes it into the build as `NEXT_PUBLIC_APP_VERSION`, which is what drives the in-app update banner. Bumping the number without rebuilding means users never see the update prompt; that is expected, not a bug — the banner appears when a *later* build ships.

| Change | Bump | Example |
|---|---|---|
| Bug fix, refactor, internal/infra change with no user-visible effect | **patch** | `v0.3.3` → `v0.3.4` |
| New feature, new endpoint, new capability | **minor** | `v0.3.4` → `v0.4.0` |
| Breaking change — removed/renamed public API, config or env var changes, DB migrations that break existing data | **major** | `v0.4.0` → `v1.0.0` |

Judge the bump **from the diff**, not from the commit message.

- Never skip a number.
- Do not bump for a bump alone. If the diff is empty or contains only whitespace, stop and ask.
- If the change sits between two levels, choose the **lower** one and mention the alternative in your report.

### 4. Commit and push

```bash
git commit -m "<type>(<scope>): <summary>"
git push origin main
```

### 5. Tag the commit you just pushed

```bash
git tag -l                      # existing tags
git tag -l v0.3.4               # must be empty before you create it
git tag -a v0.3.4 -m "v0.3.4"
git push origin main --follow-tags
```

Tags are annotated (`-a`) and named `vMAJOR.MINOR.PATCH`. The tag points at the commit that carries that version.

**Never move or force-update a tag that has already been pushed.** If the tag already exists, stop and ask.

### 6. Report

State the new version, the tag, and anything you deliberately left out of the release. If you staged selectively, name what you left behind.

## Deploy surfaces

| Surface | Trigger |
|---|---|
| Docker (`dastyaresocial/ds-cs`) | Image published from `main` after the tag lands |
| Vercel | `next build` runs `generate:config`, `generate:icons`, `upload:emojis`, `db:migrate`, `bootstrap:admin` |

`bun run build` is not just a bundle — it runs migrations and bootstraps the admin user. A build that succeeds locally has already touched the database if `DATABASE_URL` was set. That is why migration files must be committed before a release, not after.

## Also worth doing

```bash
# Keep the changelog in step with the version
$EDITOR CHANGELOG.md
```

Commit the changelog entry with the release, not as a follow-up commit — a tag that points at a commit missing its changelog entry is a release nobody can reconstruct.

## Verify before you report done

```bash
bun run test
bun run lint
git log --oneline -3
git tag -l "v$(npm pkg get version | tr -d '"')"
```

The last command should print the tag you just created.
