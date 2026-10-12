# DS-CS agent skills

First-party skills for [Dastyare Social — CS](https://cs.dastyare.social). Install them with:

```bash
npx @dastyaresocial/ds-cs init   # project or global? which agents? symlink or copy?
npx @dastyaresocial/ds-cs add   # searchable picker over every skill
```

Both are interactive and remember your last choices. To skip the prompts, pass a
skill name (`ds-cs add post-with-media`) or flags (`--global`, `-a opencode`,
`--copy`, `-y`).

## What is here

### Working on the codebase — `dev/`

For agents and humans changing DS-CS itself.

| Skill | Covers |
|---|---|
| [`dev/add-orpc-endpoint`](dev/add-orpc-endpoint) | Adding a procedure to the internal oRPC router |
| [`dev/add-component`](dev/add-component) | Components without breaking the design system |
| [`dev/db-migration`](dev/db-migration) | Drizzle schema changes and migrations |
| [`dev/release`](dev/release) | Version bump, annotated tag, push |

### Operating a channel — `product/`

For agents acting *on* a live channel.

| Skill | Covers |
|---|---|
| [`product/post-with-media`](product/post-with-media) | Posts, media upload, pinning |
| [`product/manage-stories`](product/manage-stories) | Ephemeral stories |
| [`product/webhooks`](product/webhooks) | Signed event delivery |
| [`product/brand-config`](product/brand-config) | Channel identity and the `/about` page |
| [`product/self-host-deploy`](product/self-host-deploy) | Install, update, back up |
| [`product/mcp-connect`](product/mcp-connect) | Connecting an agent over MCP |

## Writing one

A skill is a directory containing `SKILL.md`:

```markdown
---
name: my-skill
description: What it does and, more importantly, when to reach for it.
---

# My Skill

Instructions.
```

The `description` is the entire interface. It is the only thing an agent sees before deciding whether to load the skill, so it has to answer "is this my problem?" in one line. Write it as *use when…*, and name the neighbouring skills that should be used instead — an agent that loads the wrong skill is worse than one that loads none.

Keep `SKILL.md` to instructions. Reference material, scripts and templates go in the same directory under their own names; they travel with the skill and are loaded only when the instructions point at them.

Add `metadata.internal: true` to hide a skill from discovery until `INSTALL_INTERNAL_SKILLS=1`.

## Testing a change

While inside a DS-CS checkout, `ds-cs add` installs from this directory rather than from GitHub, so edits take effect immediately:

```bash
npx @dastyaresocial/ds-cs add brand-config --force
```

Run it from a scratch directory to test what a user actually gets:

```bash
mkdir /tmp/t && cd /tmp/t && git init -q
node /path/to/ds-cs/scripts/cli/bin/ds-cs.mjs add brand-config
```
